const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/editing/clipboard_session.js', 'src/commands/clipboard_command.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
function fixture() {
  const events = [], hints = [], state = { mode: true, editable: true, deleted: true, failure: null, model: [] };
  const payload = { pasteCount: 0, points: [{}], lines: [], circles: [], arcs: [], blockInstances: [], selection: {} };
  state.copyPayload = payload;
  const session = sandbox.window.ClipboardSession.create({ pasteOffsetScreenPx: 24,
    onCopyStored: () => events.push('stored'), deleteSelection: () => { events.push('delete'); return state.deleted; } });
  const command = sandbox.window.ClipboardCommand.create({ session,
    isGeometryMode: () => state.mode, buildCopyPayload: () => state.copyPayload,
    canCreate: () => { events.push('guard'); return state.editable; }, blockDefinitionScopeError: id => id === 'bad' ? 'invalid Block' : null,
    currentTarget: () => { events.push('target'); return { model: state.model, sketchId: 'S2', scale: 2 }; },
    parameterTarget: () => { events.push('parameters'); return { namespace: {}, namespaceKey: 'document' }; },
    checkpoint: { capture: model => { events.push('capture'); const length = model.length; return { rollback: () => { events.push('rollback'); model.length = length; } }; } },
    graph: { append: (model, input, target) => {
      events.push('append'); assert.equal(input, payload); assert.equal(target.dx, 12); assert.equal(target.sketchId, 'S2');
      model.push('pasted'); if (state.failure === 'append') throw new Error('append failure'); return { maps: {} };
    } }, clearSelection: () => events.push('clear'), selection: { applyClipboard: () => events.push('selection') },
    finishPaste: () => { events.push('finish'); assert.equal(payload.pasteCount, 1); if (state.failure === 'finish') throw new Error('solve failure'); },
    recoverView: () => events.push('recover'), sketchName: id => id,
    setHint: (...args) => { hints.push(args); events.push('hint'); }, updateToolbar: () => events.push('toolbar'),
  });
  return { state, session, command, payload, events, hints };
}

test('copy guards leave Clipboard intact and empty copy updates feedback before the toolbar', () => {
  const f = fixture(); f.state.mode = false; assert.equal(f.command.copy(), false); assert.equal(f.events.length, 0);
  f.state.mode = true; f.state.copyPayload = null;
  assert.equal(f.command.copy(), false); assert.equal(f.session.payload, null); assert.deepEqual(f.events, ['hint', 'toolbar']);
});

test('rejected cut leaves the payload available and emits no success hint', () => {
  const f = fixture(); f.state.deleted = false;
  assert.equal(f.command.copy({ cut: true }), false); assert.equal(f.session.payload, f.payload); assert.equal(f.payload.cut, true);
  assert.deepEqual(f.events, ['stored', 'delete']); assert.equal(f.hints.length, 0);
});

test('successful paste captures before parameter lookup and commits only after selection and session recording', () => {
  const f = fixture(); f.session.replaceForDiagnostics(f.payload);
  assert.equal(f.command.paste(), true); assert.equal(f.state.model.length, 1); assert.equal(f.payload.pasteCount, 1);
  assert.deepEqual(f.events, ['guard', 'target', 'capture', 'parameters', 'append', 'clear', 'selection', 'finish', 'hint']);
  assert.match(f.hints[0][0], /S2/);
});

test('paste guards reject without capturing or changing model and paste count', () => {
  const f = fixture(); assert.equal(f.command.paste(), false); assert.deepEqual(f.events, ['hint']);
  f.events.length = 0; f.session.replaceForDiagnostics(f.payload); f.state.editable = false;
  assert.equal(f.command.paste(), false); assert.deepEqual(f.events, ['guard']);
  f.events.length = 0; f.state.editable = true; f.payload.blockInstances.push({ definitionId: 'bad' });
  assert.equal(f.command.paste(), false); assert.deepEqual(f.events, ['guard', 'hint']);
  assert.equal(f.state.model.length, 0); assert.equal(f.payload.pasteCount, 0);
});

test('construction failure rolls back before view recovery and retains an unrecorded paste count', () => {
  const f = fixture(); f.session.replaceForDiagnostics(f.payload); f.state.failure = 'append';
  assert.equal(f.command.paste(), false); assert.equal(f.state.model.length, 0); assert.equal(f.payload.pasteCount, 0);
  assert.deepEqual(f.events.slice(-3), ['rollback', 'recover', 'hint']); assert.equal(f.events.includes('selection'), false);
  assert.match(f.hints[0][0], /append failure/); assert.equal(f.hints[0][1], 'error');
});

test('solve failure restores model but keeps the recorded paste count as the existing behavior requires', () => {
  const f = fixture(); f.session.replaceForDiagnostics(f.payload); f.state.failure = 'finish';
  assert.equal(f.command.paste(), false); assert.equal(f.state.model.length, 0); assert.equal(f.payload.pasteCount, 1);
  assert.deepEqual(f.events.slice(-4), ['finish', 'rollback', 'recover', 'hint']); assert.match(f.hints[0][0], /solve failure/);
});
