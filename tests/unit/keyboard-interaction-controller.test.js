const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/keyboard_interaction_controller.js'), 'utf8'), sandbox);
function fixture() {
  const calls = []; const state = { mode: 'select' }; const record = name => (...args) => { calls.push([name, ...args]); };
  const controller = sandbox.window.KeyboardInteractionController.create({
    menus: { closeSketch: () => state.sketchMenu, canvasVisible: () => state.canvasMenu, closeCanvas: record('menu') },
    sketchMove: { get active() { return state.moving; }, cancel: record('moveCancel') },
    constraintStatusView: { hold: () => Boolean(state.hold) },
    shortcuts: Object.fromEntries(['save', 'saveAs', 'copy', 'paste', 'undo', 'redo'].map(k => [k, record(k)])),
    dimensionInput: { handleKey: () => Boolean(state.dimension) },
    operations: { getMode: () => state.mode, isGeometryMode: () => state.geometry !== false,
      finishSources: record('sources'), finishSpline: record('spline'), finishProjection: record('projection'),
      finishInstance: record('instance'), removeSplinePoint: record('removeSpline'),
      offset: { canConfirmSelection: () => state.offsetReady, confirmSelection: record('offset') },
      getPointer: () => state.pointer, deleteSelection: () => { calls.push(['delete']); return true; },
      completeLineLength: () => Boolean(state.lineLength), cancel: record('cancel') },
    isTextEditingTarget: target => Boolean(target.text),
  });
  return { state, calls, key: (key, options = {}) => controller.keydown({ key, target: {}, preventDefault: record('prevent'), ...options }) };
}
test('menus and sketch movement intercept shortcuts with tree navigation preserved', () => {
  const f = fixture(); f.state.sketchMenu = true; f.state.moving = true; f.key('Escape');
  assert.deepEqual(f.calls, [['prevent']]);
  f.state.sketchMenu = false; f.calls.length = 0; f.key('Escape');
  assert.deepEqual(f.calls, [['moveCancel'], ['prevent']]);
  f.calls.length = 0; f.key('Enter', { target: { closest: () => true } }); assert.deepEqual(f.calls, []);
  f.key('s', { ctrlKey: true }); assert.deepEqual(f.calls, [['prevent']]);
  f.state.moving = false; f.state.canvasMenu = true; f.calls.length = 0; f.key('Escape');
  assert.deepEqual(f.calls, [['prevent'], ['menu']]);
});
test('save repeat, native clipboard and history shortcut precedence remain distinct', () => {
  const f = fixture(); f.state.dimension = true;
  f.key('S', { ctrlKey: true, repeat: true }); assert.deepEqual(f.calls, [['prevent']]);
  f.calls.length = 0; f.key('s', { metaKey: true, shiftKey: true }); assert.deepEqual(f.calls, [['prevent'], ['saveAs']]);
  f.calls.length = 0; f.key('c', { ctrlKey: true, target: { text: true } }); assert.deepEqual(f.calls, []);
  f.key('z', { ctrlKey: true, target: { text: true } }); assert.deepEqual(f.calls, [['prevent'], ['undo']]);
  f.calls.length = 0; f.key('z', { ctrlKey: true, shiftKey: true }); assert.deepEqual(f.calls, [['prevent'], ['redo']]);
});
test('dimension input wins over mode completion and text inputs skip geometry actions', () => {
  const f = fixture(); f.state.mode = 'spline'; f.state.dimension = true; f.key('Enter'); assert.deepEqual(f.calls, []);
  f.state.dimension = false; f.key('Enter', { target: { text: true } }); assert.deepEqual(f.calls, []);
  f.key('Enter'); assert.deepEqual(f.calls, [['prevent'], ['spline', false]]);
  f.calls.length = 0; f.key('Backspace'); assert.deepEqual(f.calls, [['prevent'], ['removeSpline']]);
});
test('mode completion, offset pointer and cancellation route to command APIs', () => {
  const f = fixture();
  for (const [mode, expected] of [['instance-sources', ['sources', true]], ['sketch-projection', ['projection']], ['mirror-axis', ['instance']], ['pattern-direction', ['instance']], ['free-instance-origin', ['instance']]]) {
    f.state.mode = mode; f.calls.length = 0; f.key('Enter'); assert.deepEqual(f.calls, [['prevent'], expected]);
  }
  f.state.mode = 'instance-sources'; f.calls.length = 0; f.key('Escape'); assert.deepEqual(f.calls, [['prevent'], ['sources', false]]);
  f.state.mode = 'offset'; f.state.offsetReady = true; f.state.pointer = { x: 4, y: 5 }; f.calls.length = 0; f.key('Enter');
  assert.equal(f.calls[1][1], f.state.pointer);
  f.state.mode = 'select'; f.calls.length = 0; f.key('Escape'); assert.deepEqual(f.calls, [['prevent'], ['cancel']]);
  f.calls.length = 0; f.key('Delete'); assert.deepEqual(f.calls, [['delete'], ['prevent']]);
});


test('Escape unwinds exactly one active operation in priority order', () => {
  const calls = []; const state = { mode: 'sketch-projection', instance: true, image: true, spline: {}, pending: true, constraint: true, drawing: true, tool: true, selection: true };
  const record = name => () => calls.push(name);
  const cancel = sandbox.window.KeyboardInteractionController.createCancellation({
    getMode: () => state.mode,
    instances: { cancel: () => { if (!state.instance) return false; calls.push('instance'); return true; } },
    projection: { cancel: record('projection') },
    referenceImage: { get calibrating() { return state.image; }, cancelCalibration: record('image') },
    splineEditing: { get current() { return state.spline; }, finish: record('spline') },
    blockPlacement: { finishOrCancel: record('block') },
    pending: { active: () => state.pending, cancel: record('pending') },
    constraint: { active: () => state.constraint, cancel: record('constraint') },
    drawing: { active: () => state.drawing, cancel: record('drawing'), isToolMode: () => state.tool, exit: record('exit') },
    selection: { active: () => state.selection, clear: record('selection') },
  });
  const expect = name => { calls.length = 0; cancel(); assert.deepEqual(calls, name ? [name] : []); };
  expect('instance'); state.instance = false;
  expect('projection'); state.mode = 'block-place';
  expect('image'); state.image = false;
  expect('spline'); state.spline = null;
  expect('block'); expect('block'); // A rejected placement must not fall through to pending input.
  state.mode = 'line'; expect('pending'); state.pending = false;
  expect('constraint'); state.constraint = false;
  expect('drawing'); state.drawing = false;
  expect('exit'); state.tool = false;
  expect('selection'); state.selection = false; expect(null);
});
