const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/canvas_command_cancellation.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], reads = [];
  const state = { mode: 'select', pending: null, constraint: null, active: false, tool: false, onPending: () => {}, onDrawing: () => {} };
  const command = sandbox.window.CanvasCommandCancellation.create({
    readMode: () => { reads.push('mode'); return state.mode; }, selectMode: () => { calls.push(['select']); state.mode = 'select'; },
    blockPlacementCommand: { reset: options => calls.push(['block', { ...options }]) }, drawingPreview: { setPointer: value => calls.push(['pointer', value]) },
    restoreBlockPlacementPropertiesPanel: () => calls.push(['panel']), readPending: () => { reads.push('pending'); return state.pending; },
    cancelPendingCommand: message => { calls.push(['pending', message]); state.onPending(); }, readConstraintCommand: () => { reads.push('constraint'); return state.constraint; },
    cancelConstraintTargetCommand: message => calls.push(['constraint', message]),
    drawing: { active: () => { reads.push('active'); return state.active; }, cancel: () => { calls.push(['drawing']); state.onDrawing(); }, isToolMode: () => { reads.push('tool'); return state.tool; }, exit: () => calls.push(['exit']) },
    applicationText: (_ja, en) => en, setHint: message => calls.push(['hint', message]), updateUI: () => calls.push(['ui']), draw: () => calls.push(['draw']),
  });
  return { command, calls, reads, state };
}
test('Canvas-menu cancellation visits owners sequentially and preserves panel reset and final feedback', () => {
  const f = fixture(); Object.assign(f.state, { mode: 'block-place', pending: {}, constraint: {}, active: true, tool: true });
  assert.equal(f.command.cancel(), true);
  assert.deepEqual(f.calls.map(call => call[0]), ['block', 'pointer', 'select', 'panel', 'hint', 'pending', 'constraint', 'drawing', 'exit', 'hint', 'ui', 'draw']);
  assert.deepEqual(f.calls[0][1], { preservePanelState: true }); assert.equal(f.calls[1][1], null);
  assert.equal(f.calls[5][1], ''); assert.equal(f.calls[6][1], ''); assert.equal(f.calls[9][1], 'Command canceled.');
});
test('cancellation rereads each owner after earlier cancellation and avoids stale state', () => {
  const f = fixture(); Object.assign(f.state, { pending: {}, constraint: {}, active: true, tool: true });
  f.state.onPending = () => { f.state.constraint = null; }; f.state.onDrawing = () => { f.state.tool = false; };
  assert.equal(f.command.cancel(), true); assert.deepEqual(f.calls.map(call => call[0]), ['pending', 'drawing', 'hint', 'ui', 'draw']);
});
test('no active command cancels nothing and produces no feedback or repaint', () => {
  const f = fixture(); assert.equal(f.command.cancel(), false); assert.deepEqual(f.calls, []); assert.equal(f.state.mode, 'select');
});
test('cancellable query short-circuits in existing priority order without changing owners', () => {
  const f = fixture(); f.state.mode = 'block-place'; assert.equal(f.command.hasCancellable(), true); assert.deepEqual(f.reads, ['mode']);
  f.state.mode = 'select'; f.state.pending = {}; f.reads.length = 0; assert.equal(f.command.hasCancellable(), true); assert.deepEqual(f.reads, ['mode', 'pending']);
  f.state.pending = null; f.reads.length = 0; assert.equal(f.command.hasCancellable(), false); assert.deepEqual(f.reads, ['mode', 'pending', 'constraint', 'active', 'tool']); assert.deepEqual(f.calls, []);
});
