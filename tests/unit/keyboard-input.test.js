const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
function fixture(buildShortcuts) {
  const events = [], browser = new EventTarget();
  const state = { ready: false, mode: 'select', pending: null, constraint: null, selection: false, handles: false, resizing: false,
    dimension: false, pointer: { x: 1, y: 2 }, instance: false };
  const read = value => { assert.equal(state.ready, true, 'state must only be read on input'); return value; };
  const record = name => (...args) => events.push([name, ...args]);
  const instances = { cancel: () => { if (!state.instance) return false; events.push(['instanceCancel']); return true; },
    finish() { assert.equal(this, instances); events.push(['instanceFinish']); } };
  const sandbox = { window: {} }; vm.createContext(sandbox);
  for (const file of ['src/ui/keyboard_interaction_controller.js', 'src/application/keyboard_input.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
  }
  const feature = sandbox.window.KeyboardInput.create({ window: browser,
    menus: { closeSketch: () => false, canvasVisible: () => false, closeCanvas() {} }, sketchMove: { active: false },
    constraintStatusView: { hold: () => false }, dimensionInput: { handleKey: () => state.dimension },
    shortcuts: buildShortcuts ? buildShortcuts(sandbox.window, record) : { save: record('save'), saveAs: record('saveAs'), undo: record('undo'), redo: record('redo'), nativeCopy: true, nativePaste: true },
    readMode: () => read(state.mode), isGeometryMode: () => true, instances,
    projection: { cancel: record('projection') }, referenceImage: { calibrating: false }, splineEditing: { current: null },
    blockPlacement: { finishOrCancel: record('block') }, annotationDrag: {
      get handlesActive() { return read(state.handles); }, get resizing() { return read(state.resizing); }, reset: record('annotationReset') },
    pendingCommandSession: { get current() { return read(state.pending); } }, cancelPendingCommand: record('pending'),
    constraintTargetSession: { get command() { return read(state.constraint); } }, cancelConstraintTargetCommand: record('constraint'),
    drawing: { active: () => false, isToolMode: () => false }, hasSelection: () => read(state.selection), clearSelection: record('clearSelection'),
    annotation: { active: false }, finishSources: record('sources'), finishSpline: record('spline'), finishProjection: record('finishProjection'),
    finishHatch: record('hatch'), removeSplinePoint: record('removeSpline'), offset: { canConfirmSelection: () => true, confirmSelection: record('offset') },
    readPointer: () => read(state.pointer), deleteSelection: () => false, completeLineLength: () => false,
    isTextEditingTarget: target => Boolean(target.editing), setHint: record('hint'), updateUI: record('ui'), draw: record('draw'),
  });
  function key(key, options = {}) {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { key, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false }, options);
    browser.dispatchEvent(event); return event;
  }
  return { feature, state, events, browser, key };
}

test('keyboard feature creates without state reads and owns exactly one listener across start and dispose', () => {
  const f = fixture(); assert.deepEqual(f.events, []); f.feature.start(); f.feature.start(); f.state.ready = true;
  let external = 0; f.browser.addEventListener('keydown', () => external++);
  assert.equal(f.key('s', { ctrlKey: true }).defaultPrevented, true); assert.deepEqual(f.events, [['save']]);
  f.feature.dispose(); f.events.length = 0; f.key('s', { ctrlKey: true }); assert.deepEqual(f.events, []); assert.equal(external, 2);
  f.feature.start(); f.key('z', { metaKey: true, shiftKey: true }); assert.deepEqual(f.events, [['redo']]);
  f.feature.dispose(); f.feature.dispose();
});

test('Escape resets annotation handles before other owners and selects live pending or constraint cancellation', () => {
  const f = fixture(); f.state.ready = true; f.feature.start(); f.state.handles = true; f.state.instance = true;
  f.key('Escape'); assert.deepEqual(f.events, [['annotationReset'], ['ui'], ['draw']]);
  f.events.length = 0; f.state.handles = false; f.key('Escape'); assert.deepEqual(f.events, [['instanceCancel']]);
  f.state.instance = false; f.state.pending = {}; f.state.constraint = {}; f.events.length = 0;
  f.key('Escape'); assert.deepEqual(f.events, [['pending']]);
  f.state.pending = null; f.events.length = 0; f.key('Escape'); assert.deepEqual(f.events, [['constraint']]);
  f.feature.dispose();
});

test('last Escape fallback clears selection and reports before UI and draw without creating history', () => {
  const f = fixture(); f.state.ready = true; f.feature.start(); f.key('Escape'); assert.deepEqual(f.events, []);
  f.state.selection = true; f.key('Escape'); assert.deepEqual(f.events, [['clearSelection'], ['hint', '選択を解除しました'], ['ui'], ['draw']]);
  f.feature.dispose();
});

test('completion uses current mode and pointer while dimension input and native clipboard retain precedence', () => {
  const f = fixture(); f.state.ready = true; f.feature.start(); f.state.mode = 'pattern-placement-origin';
  f.key('Enter'); assert.deepEqual(f.events, [['instanceFinish']]);
  f.events.length = 0; f.state.mode = 'offset'; f.state.pointer = { x: 9, y: 7 }; f.key('Enter');
  assert.equal(f.events[0][0], 'offset'); assert.equal(f.events[0][1], f.state.pointer);
  f.events.length = 0; f.state.dimension = true; f.key('Enter'); assert.deepEqual(f.events, []);
  f.state.dimension = false; f.state.mode = 'spline'; f.key('Backspace'); assert.deepEqual(f.events, [['removeSpline']]);
  f.events.length = 0; assert.equal(f.key('v', { ctrlKey: true }).defaultPrevented, false); assert.deepEqual(f.events, []);
  f.feature.dispose();
});


test('workspace shortcuts retain live file/history actions, native clipboard precedence and keyboard listener lifetime', () => {
  const traces = [];
  for (const composed of [false, true]) {
    let actions, files, history;
    const f = fixture((w, record) => {
      files = Object.freeze({ save: record('save'), saveAs: record('saveAs') });
      history = Object.freeze({ undo: record('undo'), redo: record('redo') });
      const copy = record('copy'), paste = record('paste');
      actions = composed ? w.KeyboardInput.createWorkspaceShortcuts({ files, history, copy, paste })
        : { save: files.save, saveAs: files.saveAs, copy, paste, nativePaste: true, nativeCopy: true, undo: history.undo, redo: history.redo };
      return actions;
    });
    assert.deepEqual(f.events, []);
    for (const key of ['save', 'saveAs']) assert.equal(actions[key], files[key]);
    for (const key of ['undo', 'redo']) assert.equal(actions[key], history[key]);
    assert.equal(Object.getPrototypeOf(actions).constructor.name, 'Object');
    assert.deepEqual(Object.keys(actions), ['save', 'saveAs', 'copy', 'paste', 'nativePaste', 'nativeCopy', 'undo', 'redo']);
    assert.ok(Object.values(Object.getOwnPropertyDescriptors(actions)).every(d => d.writable && d.enumerable && d.configurable));
    f.feature.start(); f.feature.start(); f.state.ready = true;
    for (const [key, options] of [['s', { ctrlKey: true }], ['S', { metaKey: true, shiftKey: true }],
      ['s', { ctrlKey: true, repeat: true }], ['z', { ctrlKey: true }], ['z', { metaKey: true, shiftKey: true }], ['y', { ctrlKey: true }]]) {
      assert.equal(f.key(key, options).defaultPrevented, true);
    }
    assert.deepEqual(f.events, [['save'], ['saveAs'], ['undo'], ['redo'], ['redo']]);
    for (const key of ['c', 'x', 'v']) assert.equal(f.key(key, { ctrlKey: true }).defaultPrevented, false);
    assert.equal(f.events.length, 5);
    f.feature.dispose(); f.key('s', { ctrlKey: true }); assert.equal(f.events.length, 5);
    f.feature.start(); f.key('s', { metaKey: true }); assert.equal(f.events.length, 6);
    f.feature.dispose(); traces.push(JSON.stringify(f.events));
  }
  assert.equal(traces[1], traces[0]);
});
