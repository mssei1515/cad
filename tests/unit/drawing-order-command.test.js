const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/document/drawing_order.js', 'src/commands/drawing_order_command.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
}
const emptySelection = () => ({ lines: [], circles: [], arcs: [], splines: [], hatches: [], blockInstances: [], geometryInstances: [] });
function fixture() {
  const first = { id: 'L1', sketchId: 'S1', drawingOrder: 0 }, second = { id: 'L2', sketchId: 'S1', drawingOrder: 1 }, other = { id: 'L3', sketchId: 'S2', drawingOrder: 0 };
  const model = { sketches: [{ id: 'S1' }, { id: 'S2' }], lines: [first, second, other] };
  const state = { scope: model, active: 'S1', selectedSketch: null, ordinary: true, allowed: true };
  const selection = emptySelection(), events = [];
  const command = sandbox.window.DrawingOrderCommand.create({
    currentScope: () => state.scope, canvasSelection: selection, activeSketchId: () => state.active,
    selectionSketchId: () => state.selectedSketch, ordinarySelectionMode: () => state.ordinary,
    guardSelectionEdit: () => { events.push('guard'); return state.allowed; },
    updateUI: options => events.push(['ui', options.refreshAnalysis]), draw: () => events.push('draw'),
    recordHistory: label => events.push(['history', label]), applicationText: (_ja, en) => en,
    setHint: text => events.push(['hint', text]),
  });
  return { state, selection, events, command, model, first, second, other };
}

test('reorder keeps scope arrays and object identity and completes UI, draw, history and hint in order', () => {
  const f = fixture(), lines = f.model.lines;
  f.selection.lines = [f.first];
  assert.equal(f.command.state().canForward, true);
  assert.equal(f.command.reorder('drawing-front'), true);
  assert.equal(f.first.drawingOrder, 1); assert.equal(f.second.drawingOrder, 0); assert.equal(f.other.drawingOrder, 0);
  assert.equal(f.model.lines, lines); assert.equal(f.model.lines[0], f.first);
  assert.deepEqual(f.events, ['guard', ['ui', false], 'draw', ['history', 'Drawing order changed'], ['hint', 'Changed drawing order within the active sketch.']]);
});

test('denied edits and unsupported actions or empty selections do not refresh or record history', () => {
  const f = fixture(); f.selection.lines = [f.first];
  f.state.allowed = false;
  const before = JSON.stringify(f.model);
  assert.equal(f.command.reorder('drawing-front'), false); assert.equal(JSON.stringify(f.model), before);
  assert.deepEqual(f.events, ['guard']);
  f.state.allowed = true; f.events.length = 0;
  assert.equal(f.command.reorder('unknown'), false); assert.deepEqual(f.events, ['guard']);
  f.selection.lines = []; f.events.length = 0;
  assert.equal(f.command.reorder('drawing-front'), false); assert.deepEqual(f.events, ['guard']);
});

test('topmost queries prefer the drawing Sketch then inspect inactive Sketches in reverse tree order only in ordinary selection', () => {
  const f = fixture(), third = { id: 'L4', sketchId: 'S3', drawingOrder: 0 };
  f.model.sketches.push({ id: 'S3' }); f.model.lines.push(third);
  const sketches = f.model.sketches.slice();
  assert.equal(f.command.topmostOwner([f.first, f.other, third]), f.first);
  assert.equal(f.command.topmostOwner([f.other, third]), third);
  f.state.ordinary = false;
  assert.equal(f.command.topmostOwner([f.other, third]), null);
  assert.deepEqual(f.model.sketches, sketches);
});

test('queries and reorders use the current selected Sketch and scope after Document or Block switches', () => {
  const f = fixture();
  f.selection.lines = [f.other]; f.state.selectedSketch = 'S2';
  assert.equal(f.command.state().count, 1);
  const blockFirst = { id: 'L1', sketchId: 'S1', drawingOrder: 0 }, blockSecond = { id: 'L2', sketchId: 'S1', drawingOrder: 1 };
  const host = JSON.stringify(f.model);
  f.state.scope = { sketches: [{ id: 'S1' }], lines: [blockFirst, blockSecond] };
  f.state.selectedSketch = null; f.selection.lines = [blockFirst];
  assert.equal(f.command.state().count, 1);
  assert.equal(f.command.topmostOwner([blockFirst]), blockFirst);
  assert.equal(f.command.reorder('drawing-front'), true);
  assert.equal(blockFirst.drawingOrder, 1); assert.equal(JSON.stringify(f.model), host);
});
