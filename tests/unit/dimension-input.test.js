const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function fixture(enabled = true) {
  const events = {}, frames = [], calls = [], state = { pending: null, scale: 2 }, classes = new Set();
  const input = enabled ? { hidden: true, value: '', style: { setProperty() {} },
    classList: { contains: key => classes.has(key), remove: key => classes.delete(key), toggle: (key, value) => value ? classes.add(key) : classes.delete(key) },
    addEventListener: (name, handler) => { events[name] = handler; }, focus: () => calls.push('focus'), select: () => calls.push('select') } : null;
  const shell = { hidden: true, style: { setProperty() {} } };
  const context = { window: { DimensionMetrics: { DIMENSION_SCREEN_PX_PER_MM: 4 }, Appearance: {
    annotationDisplayFactor: (_appearance, scale) => { calls.push(['factor', scale]); return scale; },
  } } };
  for (const path of ['src/ui/dimension_input_view.js', 'src/ui/dimension_input_controller.js', 'src/application/dimension_input.js']) {
    vm.runInNewContext(fs.readFileSync(path, 'utf8'), context);
  }
  const options = { input, shell, viewport: { get scale() { return state.scale; } },
    syncHighlight: value => { assert.equal(value, input); calls.push('highlight'); }, scheduleFrame: callback => frames.push(callback),
    pending: { read: () => state.pending }, display: {
      layout(target, dimension) { assert.equal(this, options.display); calls.push(['layout', target, dimension]); return { text: { x: 10, y: 20 }, textAngle: 0 }; },
      layouts: { dimensionTextOffset: (_angle, gap) => ({ x: gap, y: 0 }) },
      placement: { defaultDimensionForTarget: target => { calls.push(['default', target]); return { x: 7, y: 8 }; } },
    }, worldToCanvasScreen: point => point,
    effectiveDimensionAppearance: (_dimension, sketch) => { calls.push(['appearance', sketch]); return { dimensionTextGap: 3, dimensionTextHeight: 2 }; },
    constraintSketchId: constraint => constraint.sketchId, activeSketchId: () => 'S1',
    evaluateDimensionExpressionDraft: (_constraint, expression) => Number(expression), expressionFromUserInput: value => value,
    cancelPendingCommand: message => calls.push(['cancel', message]), startDistanceValueInput: point => calls.push(['start', point]),
    submitOffsetValue: () => calls.push('offset'), submitDistanceValue: () => calls.push('distance'),
    applicationText: ja => ja, setHint: () => calls.push('hint'), draw: () => calls.push('draw') };
  const feature = context.window.DimensionInput.create(options);
  function key(value) { return { key: value, stopPropagation: () => calls.push('stop'), preventDefault: () => calls.push('prevent') }; }
  return { feature, state, input, shell, events, frames, calls, classes, key };
}

test('inline input binds later and edits the current pending object without capturing an old command', () => {
  const f = fixture(); assert.deepEqual(f.events, {}); assert.deepEqual(f.calls, []);
  f.feature.bind(); assert.equal(Object.keys(f.events).length, 4);
  const old = { type: 'distance-value', buffer: 'old', target: {}, dimension: {} };
  f.state.pending = old;
  const current = { type: 'offset-value', buffer: '20', target: {}, dimension: {} }; f.state.pending = current;
  f.input.value = '32'; f.events.input();
  assert.equal(current.buffer, '32'); assert.equal(current.editing, true); assert.equal(old.buffer, 'old');
  f.events.keydown(f.key('Enter')); assert.equal(f.calls.at(-1), 'offset');
  f.state.pending = old; f.events.keydown(f.key('Enter')); assert.equal(f.calls.at(-1), 'distance');
  f.events.keydown(f.key('Escape')); assert.equal(f.calls.at(-1)[0], 'cancel');
});

test('scheduled focus resolves the latest scope, scale and signed angle validation through the real view', () => {
  const f = fixture(); f.feature.controller.focus(); assert.equal(f.frames.length, 1); assert.deepEqual(f.calls, []);
  f.state.scale = 5;
  f.state.pending = { type: 'distance-value', buffer: '-20', target: { interval: true }, dimension: {}, constraint: { sketchId: 'S9' } };
  f.frames.shift()();
  assert.equal(f.shell.hidden, false); assert.equal(f.input.hidden, false);
  assert.equal(f.shell.style.left, '25px'); assert.equal(f.shell.style.fontSize, '40px');
  assert.equal(f.classes.has('is-invalid'), false);
  assert.ok(f.calls.some(call => call[0] === 'appearance' && call[1] === 'S9'));
  assert.deepEqual(f.calls.slice(-2), ['focus', 'select']);
  f.state.pending = null; f.feature.controller.sync(); assert.equal(f.shell.hidden, true);
});

test('missing input stays inert while canvas keys keep using the shared placement and command callbacks', () => {
  const f = fixture(false); f.feature.bind(); f.feature.controller.sync(); assert.deepEqual(f.events, {}); assert.deepEqual(f.calls, []);
  f.state.pending = { type: 'distance-place', target: { id: 'L1' } };
  assert.equal(f.feature.controller.handleKey(f.key('Enter')), true);
  assert.equal(f.calls[1][0], 'default'); assert.equal(f.calls[2][0], 'start');
  assert.equal(f.calls[2][1].x, 7); assert.equal(f.calls[2][1].y, 8);
});
