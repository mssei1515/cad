const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/trim_command.js'), 'utf8'), sandbox);
function fixture() {
  const events = [], pointer = { x: 2, y: 3 }, item = {}, failure = new Error('unexpected failure');
  const state = { identity: { sketchId: 'S1' }, active: 'S1', allowed: true, projectionAllowed: true,
    preview: { kind: 'line', item }, value: 'original', selection: item, previewVisible: true,
    solved: { success: true, result: { errorNorm: 1e-4 } }, throwAt: null };
  const trim = kind => preview => { assert.equal(preview, state.preview); events.push(kind); state.value = 'trimmed'; if (state.throwAt === 'edit') throw failure; };
  const command = sandbox.window.TrimCommand.create({
    hitSketchIdentityElement: (x, y, options) => { assert.equal(x, 2); assert.equal(y, 3); assert.equal(options.allowInactiveGeometry, true); events.push('identity'); return state.identity; },
    guardSketchEdit: (id, operation) => { events.push(['guard', id, operation]); return state.allowed; },
    activeSketchId: () => { events.push('active'); return state.active; },
    computeTrimPreview: value => { assert.equal(value, pointer); events.push('preview'); return state.preview; },
    setHint: (...args) => events.push(['hint', ...args]), draw: () => events.push('draw'),
    guardSketchProjectionShapeEdit: (items, options) => { assert.equal(items[0], item); assert.equal(options.action, 'Trim'); events.push('projectionGuard'); return state.projectionAllowed; },
    applicationText: (_ja, en) => en, clearTrimPreview: () => { events.push('clearPreview'); state.previewVisible = false; },
    editing: { executeLineTrim: trim('line'), executeArcTrim: trim('arc'), executeCircleTrim: trim('circle') },
    checkpoint: { capture: () => { events.push('snapshot'); state.snapshot = { value: state.value }; return state.snapshot; },
      restore: snapshot => { assert.equal(snapshot, state.snapshot); events.push('restore'); state.value = snapshot.value; } },
    clearSelection: () => { events.push('selection'); state.selection = null; },
    stabilizeActiveParameterNamespace: id => { events.push(['solve', id]); if (state.throwAt === 'solve') throw failure; return state.solved; },
    acceptError: 1e-4, invalidateAnalysis: () => events.push('invalidate'), refreshConstraintAnalysis: () => events.push('analysis'),
    updateUI: options => { events.push(['ui', options?.refreshAnalysis]); if (state.throwAt === 'ui') throw failure; },
    recordHistory: label => events.push(['history', label]),
  });
  return { command, state, events, pointer, failure };
}
const eventNames = events => events.map(value => Array.isArray(value) ? value[0] : value);

test('trim succeeds at the existing error threshold, dispatches geometry kinds and records history after UI and drawing', () => {
  for (const kind of ['line', 'arc', 'circle']) {
    const f = fixture(); f.state.preview.kind = kind;
    assert.equal(f.command.execute(f.pointer), true);
    assert.equal(f.state.value, 'trimmed'); assert.equal(f.state.selection, null); assert.equal(f.state.previewVisible, false);
    assert.deepEqual(eventNames(f.events), ['identity', 'guard', 'preview', 'projectionGuard', 'snapshot', kind,
      'clearPreview', 'selection', 'active', 'solve', 'invalidate', 'analysis', 'hint', 'ui', 'draw', 'history']);
    assert.deepEqual(f.events.at(-3), ['ui', false]); assert.deepEqual(f.events.at(-1), ['history', 'トリム']);
  }
});

test('trim rejection preserves the distinct guard, missing-preview and projected-shape cleanup paths', () => {
  const denied = fixture(); denied.state.allowed = false; denied.state.identity = null;
  assert.equal(denied.command.execute(denied.pointer), false);
  assert.deepEqual(denied.events, ['identity', 'active', ['guard', 'S1', 'structure']]);
  assert.equal(denied.state.value, 'original'); assert.equal(denied.state.previewVisible, true);
  const missing = fixture(); missing.state.preview = null;
  assert.equal(missing.command.execute(missing.pointer), false);
  assert.equal(missing.state.previewVisible, true); assert.equal(missing.state.value, 'original');
  assert.deepEqual(eventNames(missing.events), ['identity', 'guard', 'preview', 'hint', 'draw']);
  const projected = fixture(); projected.state.projectionAllowed = false;
  assert.equal(projected.command.execute(projected.pointer), false);
  assert.equal(projected.state.previewVisible, false); assert.equal(projected.state.value, 'original');
  assert.deepEqual(eventNames(projected.events), ['identity', 'guard', 'preview', 'projectionGuard', 'clearPreview', 'draw']);
});

test('trim restores geometry after primary, dependent or excessive-error failure without recording a new history step', () => {
  for (const solved of [{ success: false, result: null }, { success: true, result: null, dependent: { success: false } },
    { success: true, result: { errorNorm: 0.001 } }]) {
    const f = fixture(); f.state.solved = solved;
    assert.equal(f.command.execute(f.pointer), false); assert.equal(f.state.value, 'original');
    assert.equal(f.state.selection, null); assert.equal(f.state.previewVisible, false);
    assert.deepEqual(eventNames(f.events).slice(-4), ['restore', 'hint', 'ui', 'draw']);
    assert.equal(f.events.find(e => e[0] === 'hint')[2], 'error');
    assert.equal(eventNames(f.events).includes('history'), false); assert.equal(eventNames(f.events).includes('invalidate'), false);
  }
});

test('trim preserves unexpected exception propagation instead of expanding the rollback boundary', () => {
  for (const phase of ['edit', 'solve', 'ui']) {
    const f = fixture(); f.state.throwAt = phase;
    assert.throws(() => f.command.execute(f.pointer), error => error === f.failure);
    assert.equal(f.state.value, 'trimmed');
    assert.equal(eventNames(f.events).includes('restore'), false); assert.equal(eventNames(f.events).includes('history'), false);
  }
});
