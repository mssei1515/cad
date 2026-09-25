const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/dimension_input_controller.js'), 'utf8'), sandbox);
function fixture() {
  const calls = []; let pending = { type: 'distance-value', buffer: '20', target: {}, dimension: {} }, evaluated = 20, focus;
  const controller = sandbox.window.DimensionInputController.create({
    view: { hide: () => calls.push(['hide']), render: data => calls.push(['render', data]), setInvalid: value => calls.push(['invalid', value]), focus: sync => { focus = sync; } },
    getPending: () => pending, dimensionLayout: () => ({ text: { x: 2, y: 3 }, textAngle: NaN }),
    worldToCanvasScreen: point => ({ x: point.x * 2, y: point.y * 2 }),
    effectiveDimensionAppearance: (_dimension, sketchId) => { calls.push(['appearance', sketchId]); return { dimensionTextGap: 4, dimensionTextHeight: 3 }; },
    constraintSketchId: c => c.sketchId, activeSketchId: () => 'S1', dimensionTextOffset: (angle, gap) => ({ x: gap, y: angle }),
    evaluateDimensionExpressionDraft: (_constraint, expression) => { calls.push(['evaluate', expression]); if (evaluated instanceof Error) throw evaluated; return evaluated; },
    expressionFromUserInput: value => `parsed:${value}`,
  });
  return { controller, calls, get pending() { return pending; }, setPending: value => { pending = value; }, setValue: value => { evaluated = value; }, focus: () => focus() };
}
test('maps layout and appearance to the view before evaluating an expression', () => {
  const f = fixture(); f.pending.constraint = { sketchId: 'S9' }; const before = JSON.stringify(f.pending);
  f.controller.sync();
  assert.equal(f.calls[0][1], 'S9'); assert.equal(f.calls[1][0], 'render');
  assert.equal(f.calls[1][1].screen.x, 4); assert.equal(f.calls[1][1].angle, 0);
  assert.deepEqual(f.calls[2], ['evaluate', 'parsed:20']); assert.deepEqual(f.calls[3], ['invalid', false]);
  assert.equal(JSON.stringify(f.pending), before);
});
test('nonfinite, nonpositive, angle boundary and evaluation errors are invalid', () => {
  for (const value of [NaN, Infinity, 0, -1, new Error('expression')]) {
    const f = fixture(); f.setValue(value); f.controller.sync(); assert.deepEqual(f.calls.at(-1), ['invalid', true]);
  }
  const f = fixture(); f.pending.target.kind = 'angle'; f.setValue(180); f.controller.sync();
  assert.deepEqual(f.calls.at(-1), ['invalid', true]);
  f.setValue(179); f.controller.sync(); assert.deepEqual(f.calls.at(-1), ['invalid', false]);
});
test('offset uses numeric input rather than the expression evaluator', () => {
  const f = fixture(); f.pending.type = 'offset-value'; f.pending.buffer = '25'; f.controller.sync();
  assert.equal(f.calls.some(call => call[0] === 'evaluate'), false); assert.deepEqual(f.calls.at(-1), ['invalid', false]);
  f.pending.buffer = '=25'; f.controller.sync(); assert.deepEqual(f.calls.at(-1), ['invalid', true]);
});
test('focus synchronization reads the latest pending command after cancellation', () => {
  const f = fixture(); f.controller.focus(); f.setPending(null); f.focus(); assert.deepEqual(f.calls, [['hide']]);
});

function keyboardFixture() {
  const calls = [];
  let pending = { type: 'distance-value', buffer: '20', editing: false };
  const controller = sandbox.window.DimensionInputController.create({
    enabled: false, getPending: () => pending,
    applicationText: text => text, setHint: () => calls.push('hint'), draw: () => calls.push('draw'),
    cancelPendingCommand: () => calls.push('cancel'),
    startDistanceValueInput: point => calls.push(point), defaultDimensionForTarget: () => 'default-position',
    submitOffsetValue: () => calls.push('offset'), submitDistanceValue: () => calls.push('dimension'),
  });
  return { calls, get pending() { return pending; }, setPending: value => { pending = value; },
    key: key => controller.handleKey({ key, preventDefault: () => calls.push('prevent') }) };
}

test('canvas numeric editing replaces initial value, suppresses repeated decimal, and supports deletion', () => {
  const f = keyboardFixture();
  assert.equal(f.key('3'), true); assert.equal(f.pending.buffer, '3');
  assert.equal(f.pending.editing, true);
  f.key('.'); f.key('5'); assert.equal(f.pending.buffer, '3.5');
  const draws = f.calls.filter(call => call === 'draw').length;
  assert.equal(f.key('.'), true); assert.equal(f.pending.buffer, '3.5');
  assert.equal(f.calls.filter(call => call === 'draw').length, draws);
  f.key('Backspace'); assert.equal(f.pending.buffer, '3.');
  f.key('Delete'); assert.equal(f.pending.buffer, '');
  assert.equal(f.key('='), false); assert.equal(f.pending.buffer, '');
});

test('keyboard routes placement, distance and offset without consuming unrelated command keys', () => {
  const f = keyboardFixture();
  f.key('Enter'); assert.equal(f.calls.at(-1), 'dimension');
  f.setPending({ type: 'offset-value', buffer: '10' });
  f.key('Enter'); assert.equal(f.calls.at(-1), 'offset');
  f.setPending({ type: 'distance-place', target: {} });
  assert.equal(f.key('1'), false);
  f.key('Enter'); assert.equal(f.calls.at(-1), 'default-position');
  f.pending.pointer = { x: 4, y: 7 };
  f.key('Enter'); assert.equal(f.calls.at(-1), f.pending.pointer);
  f.key('Escape'); assert.equal(f.calls.at(-1), 'cancel');
  f.setPending({ type: 'fillet-value' }); const before = f.calls.length;
  assert.equal(f.key('Enter'), false); assert.equal(f.calls.length, before);
  f.setPending(null); assert.equal(f.key('Escape'), false);
});
