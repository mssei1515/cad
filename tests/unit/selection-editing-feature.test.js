const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function fixture(configure = () => {}) {
  const events = [], captured = {}, state = { ready: false, allowed: true, failure: null, failAt: null,
    workspace: { points: [] }, bound: { points: [] } }, marker = new Error('selection editing failed');
  const never = () => assert.fail('no eager operation');
  const input = {
    documentWorkspace: { workspace: { current() { assert.equal(state.ready, true); return state.workspace; } } },
    editingScope: { get current() { assert.equal(state.ready, true); return state.bound; } },
    readServices: {}, interaction: { selection: { points: [] } }, references: {}, geometry: {},
    annotationFeature: Object.freeze({ dimensions: {}, renderer: {} }), annotationLeaderAnchor: never,
    splineEditing: {}, guardDimensionSymbolDeletion: never, sessions: {}, lineCommand: {}, circularCommands: {},
    solving: {}, analysis: {}, presentation: {}, updateToolbar: never, recordHistory: never,
    referenceImageInteraction: {}, clearSelection: never, solveAndRefresh: never,
    resetGeometryDrag: never, resetDimensionDrag: never, resetAnnotationDrag: never, viewport: {},
    persistence: Object.freeze({ serializeConstraint: never, decorateSerializedConstraint: never, deserializeConstraint: never }),
    normalizeGeometryInstance: never, blocks: { session: Object.freeze({ scopeId: never }), queries: Object.freeze({ blockDefinitionScopeError: never }) },
    pasteOffsetScreenPx: 24, imageClipboard: {}, isGeometryMode: never,
  };
  const deletion = Object.freeze({ remove: never, removeSelection() {
    assert.equal(state.ready, true); events.push('delete'); if (state.failure) throw state.failure;
    if (!state.allowed) return false;
    const model = input.documentWorkspace.workspace.current();
    model.points = model.points.filter(point => !input.interaction.selection.points.includes(point));
    return true;
  } });
  const sandbox = { window: {} }; vm.createContext(sandbox); const w = sandbox.window;
  vm.runInContext(fs.readFileSync('src/editing/clipboard_session.js', 'utf8'), sandbox);
  w.DeletionFeature = { createForEditing(ports) {
    assert.equal(this, w.DeletionFeature); assert.equal(arguments.length, 1); events.push('construct:delete'); captured.deletion = ports;
    if (state.failAt === 'deletion') throw marker; return deletion;
  } };
  w.ClipboardFeature = { createForEditing(ports) {
    assert.equal(this, w.ClipboardFeature); assert.equal(arguments.length, 1); events.push('construct:clipboard'); captured.clipboard = ports;
    if (state.failAt === 'clipboard') throw marker;
    return Object.freeze({ session: w.ClipboardSession.create({ pasteOffsetScreenPx: ports.pasteOffsetScreenPx,
      onCopyStored: () => events.push('stored'), deleteSelection: ports.deleteSelection }),
      readModel: () => ports.editingScope.current });
  } };
  vm.runInContext(fs.readFileSync('src/application/selection_editing_feature.js', 'utf8'), sandbox);
  configure(input, state);
  const create = () => w.SelectionEditingFeature.createForEditing(input);
  return { input, state, events, captured, deletion, marker, create, w };
}

test('selection editing shares actual owners, codecs and deletion API without reading either scope during ordered construction', () => {
  const f = fixture(), feature = f.create(), d = f.captured.deletion, c = f.captured.clipboard;
  assert.deepEqual(f.events, ['construct:delete', 'construct:clipboard']); assert.equal(Object.isFrozen(feature), true);
  assert.equal(feature.deletion, f.deletion); assert.equal(feature.clipboard.session.payload, null);
  for (const key of ['documentWorkspace', 'readServices', 'interaction', 'references', 'geometry', 'presentation', 'updateToolbar', 'clearSelection', 'solveAndRefresh']) {
    assert.equal(d[key], f.input[key]); assert.equal(c[key], f.input[key]);
  }
  assert.equal(d.annotationDimensions, f.input.annotationFeature.dimensions); assert.equal(c.annotationRenderer, f.input.annotationFeature.renderer);
  for (const key of ['serializeConstraint', 'decorateSerializedConstraint', 'deserializeConstraint']) assert.equal(c[key], f.input.persistence[key]);
  assert.equal(c.blockScopeId, f.input.blocks.session.scopeId); assert.equal(c.blockDefinitionScopeError, f.input.blocks.queries.blockDefinitionScopeError);
  assert.equal(c.deleteSelection, feature.deletion.removeSelection); assert.equal(c.editingScope, f.input.editingScope);
  assert.equal(d.resetGeometryDrag, f.input.resetGeometryDrag); assert.equal(d.resetDimensionDrag, f.input.resetDimensionDrag);
  assert.equal(d.resetAnnotationDrag, f.input.resetAnnotationDrag); assert.equal(c.annotationLeaderAnchor, f.input.annotationLeaderAnchor);
  assert.equal(c.normalizeGeometryInstance, f.input.normalizeGeometryInstance); assert.equal(c.pasteOffsetScreenPx, 24);
});

test('native Clipboard cut uses the same exposed deletion and keeps Workspace deletion separate from bound Clipboard scope', () => {
  const f = fixture(), feature = f.create(), point = { id: 'P1' }, other = { id: 'B1' };
  f.state.ready = true; f.state.workspace.points = [point]; f.state.bound.points = [other]; f.input.interaction.selection.points = [point];
  const payload = () => ({ points: [{ id: 'copy' }], lines: [], circles: [], arcs: [], blockInstances: [], pasteCount: 0 });
  const copied = payload(); f.events.length = 0;
  assert.equal(feature.clipboard.session.copy(copied), true); assert.deepEqual(f.events, ['stored']); assert.equal(f.state.workspace.points[0], point);
  f.state.allowed = false; const rejected = payload(); f.events.length = 0;
  assert.equal(feature.clipboard.session.copy(rejected, true), false); assert.equal(feature.clipboard.session.payload, rejected);
  assert.equal(rejected.cut, true); assert.deepEqual(f.events, ['stored', 'delete']); assert.equal(f.state.workspace.points[0], point);
  f.state.allowed = true; assert.equal(feature.clipboard.session.copy(payload(), true), true); assert.equal(f.state.workspace.points.length, 0);
  assert.equal(feature.clipboard.readModel(), f.state.bound); assert.equal(f.state.bound.points[0], other);
  f.state.workspace = { points: [point] }; f.state.bound = { points: [{ id: 'new-bound' }] };
  assert.equal(feature.deletion.removeSelection(), true); assert.equal(f.state.workspace.points.length, 0); assert.equal(feature.clipboard.readModel(), f.state.bound);
  const failure = new Error('delete refused'); f.state.failure = failure; const failed = payload();
  assert.throws(() => feature.clipboard.session.copy(failed, true), error => error === failure); assert.equal(feature.clipboard.session.payload, failed);
});

test('selection construction propagates the original failure and never constructs Clipboard after deletion fails', () => {
  for (const failAt of ['deletion', 'clipboard']) {
    const f = fixture((_input, state) => { state.failAt = failAt; });
    assert.throws(f.create, error => error === f.marker);
    assert.deepEqual(f.events, failAt === 'deletion' ? ['construct:delete'] : ['construct:delete', 'construct:clipboard']);
    assert.deepEqual(f.state.workspace.points, []); assert.deepEqual(f.state.bound.points, []);
  }
});

test('selection assembly forwards explicit null callbacks and supplied owner values without fallback rules', () => {
  const f = fixture(input => {
    input.persistence = Object.freeze({ serializeConstraint: null, decorateSerializedConstraint: undefined, deserializeConstraint: null });
    input.blocks = { session: { scopeId: null }, queries: { blockDefinitionScopeError: null } };
    input.resetGeometryDrag = null; input.resetDimensionDrag = undefined; input.resetAnnotationDrag = null;
  });
  f.create(); assert.equal(f.captured.clipboard.serializeConstraint, null); assert.equal(f.captured.clipboard.decorateSerializedConstraint, undefined);
  assert.equal(f.captured.clipboard.deserializeConstraint, null); assert.equal(f.captured.clipboard.blockScopeId, null);
  assert.equal(f.captured.clipboard.blockDefinitionScopeError, null); assert.equal(f.captured.deletion.resetGeometryDrag, null);
  assert.equal(f.captured.deletion.resetDimensionDrag, undefined); assert.equal(f.captured.deletion.resetAnnotationDrag, null);
});

function attachPreparedCommand(f, build, inspectOptions = options => assert.equal(options, f.input)) {
  const raw = f.w.ClipboardFeature.createForEditing;
  f.w.ClipboardFeature = { createForEditing(ports) {
    const feature = raw.call(this, ports);
    return Object.freeze({ ...feature, command: build(feature, ports) });
  } };
  const selection = f.w.SelectionEditingFeature;
  f.w.SelectionEditingFeature = Object.freeze({ ...selection, createForEditing(options) {
    assert.equal(this, f.w.SelectionEditingFeature); assert.equal(arguments.length, 1); inspectOptions(options);
    return f.captured.actual = selection.createForEditing.call(this, options);
  } });
  return f.w.SelectionEditingFeature.prepare();
}

test('prepared Selection owns native Clipboard construction and stable operations with original guards, defaults, arity and errors', () => {
  const f = fixture(), calls = [], result = {}, error = new Error('command method failed');
  const command = { copy(options) { assert.equal(this, command); assert.equal(arguments.length, 1); calls.push(options); return result; },
    paste() { assert.equal(this, command); assert.equal(arguments.length, 0); calls.push('paste'); return result; } };
  const owner = attachPreparedCommand(f, () => command);
  assert.deepEqual(f.events, []); assert.deepEqual(calls, []); assert.ok(Object.isFrozen(owner));
  for (const invoke of [() => owner.copy(), () => owner.paste('ignored')]) {
    assert.throws(invoke, { name: 'ReferenceError', message: "Cannot access 'clipboardCommand' before initialization" });
  }
  assert.equal(owner.copy.name, 'copySelectionToClipboard'); assert.equal(owner.paste.name, 'pasteGeometryClipboard');
  const feature = owner.createForEditing(f.input);
  assert.equal(feature, f.captured.actual); assert.equal(feature.deletion, f.deletion); assert.equal(feature.clipboard.command, command);
  assert.deepEqual(f.events, ['construct:delete', 'construct:clipboard']);
  assert.equal(owner.copy(), result); assert.equal(owner.copy(undefined), result);
  assert.equal(Object.keys(calls[0]).length, 0); assert.equal(Object.keys(calls[1]).length, 0); assert.notEqual(calls[0], calls[1]);
  const options = { cut: true }; assert.equal(owner.copy(options, 'ignored'), result); assert.equal(calls[2], options);
  assert.equal(owner.copy(null), result); assert.equal(calls[3], null);
  assert.equal(owner.paste('ignored'), result); assert.equal(calls[4], 'paste');
  Object.defineProperty(command, 'copy', { get() { throw error; } });
  assert.throws(() => owner.copy(options), failure => failure === error);
  command.paste = () => { throw error; }; assert.throws(owner.paste, failure => failure === error);
});

test('prepared Selection retains the previous Clipboard after either construction failure and isolates separate owners', () => {
  const f = fixture(); let generation = 0;
  const owner = attachPreparedCommand(f, () => { const id = generation++; return Object.freeze({ copy: () => id, paste: () => id }); });
  owner.createForEditing(f.input); assert.equal(owner.copy(), 0);
  for (const failAt of ['deletion', 'clipboard']) {
    f.state.failAt = failAt; f.events.length = 0;
    assert.throws(() => owner.createForEditing(f.input), failure => failure === f.marker);
    assert.deepEqual(f.events, failAt === 'deletion' ? ['construct:delete'] : ['construct:delete', 'construct:clipboard']);
    assert.equal(owner.copy(), 0); assert.equal(owner.paste(), 0);
  }
  f.state.failAt = null;
  const other = f.w.SelectionEditingFeature.prepare();
  assert.throws(other.copy, { name: 'ReferenceError', message: "Cannot access 'clipboardCommand' before initialization" });
  other.createForEditing(f.input); assert.equal(other.copy(), 1); assert.equal(owner.copy(), 0);
  owner.createForEditing(f.input); assert.equal(owner.copy(), 2); assert.equal(other.paste(), 1);
});

test('prepared Clipboard operations preserve native cut retention, distinct scopes and limited paste rollback', () => {
  const traces = [];
  for (const prepared of [false, true]) {
    const f = fixture(), workspacePoint = { id: 'workspace' }, boundPoint = { id: 'bound', x: 1, y: 2 };
    vm.runInNewContext(fs.readFileSync('src/commands/clipboard_command.js', 'utf8'), { window: f.w });
    const owner = attachPreparedCommand(f, base => f.w.ClipboardCommand.create({ session: base.session,
      isGeometryMode: () => true, buildCopyPayload: () => ({ points: f.input.editingScope.current.points.map(p => ({ ...p })),
        lines: [], circles: [], arcs: [], blockInstances: [], pasteCount: 0 }), canCreate: () => true,
      currentTarget: () => ({ model: f.input.editingScope.current, scale: 2, sketchId: 'S1' }),
      parameterTarget: () => { assert.equal(f.input.documentWorkspace.workspace.current(), f.state.workspace); return {}; },
      graph: { append(model, payload, { dx, dy }) { assert.equal(model, f.state.bound);
        model.points.push(...payload.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }))); f.events.push('append'); return { maps: {} }; } },
      checkpoint: { capture(model) { const points = model.points.slice(); return { rollback() { model.points = points; f.events.push('rollback'); } }; } },
      selection: { applyClipboard() { f.events.push('select'); } }, clearSelection: () => f.events.push('clear'),
      finishPaste() { f.events.push('finish'); if (f.state.failure) throw f.state.failure; }, recoverView: () => f.events.push('recover'),
      sketchName: id => id, setHint: (...args) => f.events.push(['hint', ...args]), updateToolbar: () => f.events.push('toolbar'),
    }));
    let command;
    const copy = prepared ? owner.copy : function (options = {}) { return command.copy(options); };
    const paste = prepared ? owner.paste : function () { return command.paste(); };
    const feature = prepared ? owner.createForEditing(f.input) : f.create(); command = feature.clipboard.command;
    assert.deepEqual(f.events, ['construct:delete', 'construct:clipboard']); f.events.length = 0;
    f.state.ready = true; f.state.workspace.points = [workspacePoint]; f.state.bound.points = [boundPoint]; f.input.interaction.selection.points = [workspacePoint];
    assert.equal(copy(), true); assert.equal(feature.clipboard.session.payload.points[0].id, 'bound');
    f.state.allowed = false; assert.equal(copy({ cut: true }), false);
    const rejected = feature.clipboard.session.payload; assert.equal(rejected.cut, true); assert.equal(f.state.workspace.points[0], workspacePoint);
    assert.equal(paste(), true); assert.equal(rejected.pasteCount, 1); assert.deepEqual(f.state.bound.points[1], { id: 'bound', x: 13, y: 14 });
    const error = new Error('operation failed'); f.state.failure = error;
    assert.throws(() => copy({ cut: true }), failure => failure === error);
    const failedCut = feature.clipboard.session.payload; assert.equal(failedCut.cut, true); assert.equal(failedCut.pasteCount, 0);
    const before = f.state.bound.points.slice(); assert.equal(paste(), false);
    assert.equal(failedCut.pasteCount, 1); assert.deepEqual(f.state.bound.points, before); assert.equal(f.state.workspace.points[0], workspacePoint);
    traces.push(JSON.stringify({ events: f.events, workspace: f.state.workspace, bound: f.state.bound, payload: failedCut }));
  }
  assert.equal(traces[1], traces[0]);
});

test('prepared Selection passes the drawing-owned reset without command aliases and retains explicit overrides or construction failure guards', () => {
  for (const explicit of [false, true]) {
    const f = fixture(), command = { copy() {}, paste() {} }, reset = () => assert.fail('no eager reset');
    const owner = attachPreparedCommand(f, () => command, options => { assert.equal(options.resetDrawing, explicit ? null : reset); assert.equal(options.documentWorkspace, f.input.documentWorkspace); });
    delete f.input.lineCommand; delete f.input.circularCommands;
    const drawing = Object.freeze({ resetForDeletion: reset });
    const feature = owner.createForDrawing({ drawing, ...f.input, ...(explicit ? { resetDrawing: null } : {}) });
    assert.equal(feature, f.captured.actual); assert.equal(f.captured.deletion.resetDrawing, explicit ? null : reset);
    assert.equal(f.captured.deletion.lineCommand, undefined); assert.equal(f.captured.deletion.circularCommands, undefined);
    assert.deepEqual(f.events, ['construct:delete', 'construct:clipboard']);
    const marker = new Error('drawing port'); const bad = { get resetForDeletion() { throw marker; } };
    assert.throws(() => owner.createForDrawing({ ...f.input, drawing: bad }), error => error === marker);
    assert.equal(owner.copy(), undefined); const fresh = f.w.SelectionEditingFeature.prepare();
    assert.throws(() => fresh.createForDrawing({ ...f.input, drawing: bad }), error => error === marker);
    assert.throws(fresh.paste, error => error.name === 'ReferenceError');
  }
});
