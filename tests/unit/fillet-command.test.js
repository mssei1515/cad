const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/fillet_command.js'), 'utf8'), sandbox);
function fixture(overrides = {}) {
  let pending = null;
  const calls = [], snapshot = {};
  const command = sandbox.window.FilletCommand.create({
    getPending: () => pending, setPending: value => { pending = value; },
    guardSketchProjectionShapeEdit: () => true, filletGeometryBasis: () => ({ ok: true }),
    filletGeometryFromPointer: () => ({ ok: true, radius: 20 }), hideDimensionValueInput: () => {},
    snapshotGeometryMutationState: () => { calls.push('snapshot'); return snapshot; },
    restoreGeometryMutationState: value => { assert.equal(value, snapshot); calls.push('restore'); },
    createFillet: () => { calls.push('create'); return { ok: true }; },
    clearSelection: () => calls.push('selection'), selection: { set: () => {} },
    stabilize: () => { calls.push('stabilize'); return { success: true, result: { errorNorm: 0 } }; }, acceptError: 1e-4,
    invalidateAnalysis: () => calls.push('invalidate'), refreshConstraintAnalysis: () => calls.push('analysis'),
    applicationText: (_ja, en) => en, setHint: () => calls.push('hint'), updateUI: () => calls.push('ui'),
    updateGeometrySelectionUI: () => {}, draw: () => calls.push('draw'), recordHistory: () => calls.push('history'),
    ...overrides,
  });
  return { command, calls, pending: () => pending };
}
test('selection retains first line until a valid different line starts radius placement', () => {
  const f = fixture(), a = {}, b = {};
  f.command.click(a, null); assert.equal(f.command.firstLine, a);
  f.command.click(a, null); assert.equal(f.pending(), null);
  f.command.click(b, { x: 5, y: 6 }); assert.equal(f.command.firstLine, null);
  assert.equal(f.pending().line1, a); assert.equal(f.pending().line2, b);
});
test('invalid preview keeps placement active without geometry or history changes', () => {
  const f = fixture({ filletGeometryFromPointer: () => ({ ok: false, reason: 'invalid' }) });
  f.command.start({}, {}); f.calls.length = 0;
  assert.equal(f.command.submit({ x: 0, y: 0 }), true);
  assert.ok(f.pending()); assert.deepEqual(f.calls, ['hint', 'draw']);
});
test('constraint failure restores the captured geometry and records no history', () => {
  const f = fixture({ stabilize: () => ({ success: true, dependent: { success: false }, result: { errorNorm: 0 } }) });
  f.command.start({}, {}); f.calls.length = 0; f.command.submit({ x: 0, y: 0 });
  assert.equal(f.pending(), null);
  assert.deepEqual(f.calls, ['snapshot', 'create', 'selection', 'restore', 'hint', 'ui', 'draw']);
});
test('successful creation analyzes and draws before recording history', () => {
  const f = fixture(); f.command.start({}, {}); f.calls.length = 0;
  f.command.submit({ x: 0, y: 0 });
  assert.deepEqual(f.calls, ['snapshot', 'create', 'selection', 'stabilize', 'invalidate', 'analysis', 'hint', 'ui', 'draw', 'history']);
  assert.equal(f.command.submit({ x: 0, y: 0 }), false);
});

test('geometry creation failure restores without stabilization', () => {
  const f = fixture({ createFillet: () => ({ ok: false, reason: 'construction failed' }) });
  f.command.start({}, {}); f.calls.length = 0; f.command.submit({ x: 0, y: 0 });
  assert.equal(f.pending(), null);
  assert.deepEqual(f.calls, ['snapshot', 'restore', 'hint', 'ui', 'draw']);
});
