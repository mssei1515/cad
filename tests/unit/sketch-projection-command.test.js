const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/sketch_projection_command.js'), 'utf8'), sandbox);
function fixture() {
  let mode = 'select', ids = 0; const model = { geometryInstances: [] }, calls = [], state = { selected: [], rectangle: [], allowed: true };
  const entry = item => item && !item.invalid ? { item, key: item.id, kind: 'line', sketchId: 'S1' } : null;
  const command = sandbox.window.SketchProjectionCommand.create({
    selectedGeometryItems: () => state.selected, sketchProjectionEntryFromItem: entry, sketchProjectionEntryFromOperand: entry,
    sketchProjectionSourceIsCovered: item => item.covered, sketchProjectionEntriesByRect: () => state.rectangle.map(entry),
    cancelConstraintTargetCommand: () => calls.push('constraintCancel'), cancelPendingCommand: () => calls.push('pendingCancel'),
    canCreateInActiveSketch: () => state.allowed, rejectRootSketchCreation: () => calls.push('reject'), clearSelection: () => calls.push('clear'),
    getMode: () => mode, setMode: value => { mode = value; }, clearSnap: () => calls.push('snap'),
    updateToolbar: () => calls.push('toolbar'), setHint: () => calls.push('hint'), applicationText: text => text,
    updateUI: () => calls.push('ui'), draw: () => calls.push('draw'), activeSketchId: () => 'S2', normalizeGeometryInstance: value => value,
    nextId: () => 'SPI' + ++ids, geometryRefForItem: item => ({ id: item.id }), currentScope: () => model,
    canvasSelection: { set: (_, value) => { state.selection = value; } }, refreshConstraintAnalysis: () => calls.push('analysis'),
    recordHistory: () => calls.push('history'), clearHover: () => calls.push('hover'),
  });
  return { command, model, calls, state, mode: () => mode, ids: () => ids };
}
test('start stages unique eligible sources and rejected root does not replace the draft', () => {
  const f = fixture(); const a = { id: 'A' }; f.state.selected = [a, a, { id: 'B', covered: true }, { invalid: true }]; f.command.start();
  assert.equal(f.command.count, 1); assert.equal(f.command.includes(a), true); f.command.sources.pop(); assert.equal(f.command.count, 1);
  assert.equal(f.mode(), 'sketch-projection'); assert.equal(f.model.geometryInstances.length, 0);
  f.state.allowed = false; f.calls.length = 0; f.command.start();
  assert.equal(f.command.count, 1); assert.deepEqual(f.calls, ['constraintCancel', 'pendingCancel', 'reject']);
});
test('toggle and rectangle staging retain identity and reject covered or invalid operands', () => {
  const f = fixture(); f.command.start(); const a = { id: 'A' }, b = { id: 'B' };
  assert.equal(f.command.toggle(a), true); assert.equal(f.command.toggle({ invalid: true }), false);
  assert.equal(f.command.toggle({ id: 'C', covered: true }), false);
  f.state.rectangle = [a, b, b, { id: 'C', covered: true }]; assert.equal(f.command.addByRect({}, true), 1);
  assert.equal(f.command.count, 2); assert.equal(f.command.sources[1].item, b);
  a.covered = true; assert.equal(f.command.toggle(a), true); assert.equal(f.command.count, 1);
  f.command.remove(0); assert.equal(f.command.count, 0);
});
test('commit rechecks coverage, preserves source references and records one history step', () => {
  const f = fixture(); const a = { id: 'A' }, b = { id: 'B' }; f.state.selected = [a, b]; f.command.start(); a.covered = true;
  f.calls.length = 0; assert.equal(f.command.commit(), true);
  const instance = f.model.geometryInstances[0]; assert.equal(instance.sources.length, 1); assert.equal(instance.sources[0].id, 'B');
  assert.equal(instance.id, 'SPI1'); assert.equal(instance.sketchId, 'S2'); assert.equal(f.state.selection[0], instance);
  assert.equal(f.mode(), 'select'); assert.equal(f.command.count, 0);
  assert.deepEqual(f.calls, ['clear', 'analysis', 'toolbar', 'ui', 'draw', 'hint', 'history']);
  assert.equal(f.command.commit(), false); assert.equal(f.ids(), 1);
});
test('empty commit retains draft, while cancel and reset never create model or history entries', () => {
  const f = fixture(); const a = { id: 'A' }; f.state.selected = [a]; f.command.start(); a.covered = true;
  assert.equal(f.command.commit(), false); assert.equal(f.command.count, 1); assert.equal(f.ids(), 0);
  f.calls.length = 0; f.command.cancel(); assert.equal(f.mode(), 'select'); assert.equal(f.command.count, 0);
  assert.deepEqual(f.calls, ['hover', 'toolbar', 'hint', 'ui', 'draw']); assert.equal(f.model.geometryInstances.length, 0);
  f.calls.length = 0; f.command.reset(); assert.deepEqual(f.calls, []);
});
