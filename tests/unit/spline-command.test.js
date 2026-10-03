const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { GeometrySolver: { hypot2: (x, y) => Math.sqrt(x * x + y * y) } } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/spline_command.js'), 'utf8'), sandbox);
function fixture(count = 3, success = true, allowed = true) {
  const calls = [];
  const points = Array.from({ length: count }, (_, i) => ({ x: i * 10, y: 0 }));
  const spline = { id: 'SP1' };
  const draft = { points, reset: () => { calls.push('reset'); draft.points = []; },
    add: () => true, discardDoubleClick: () => false };
  let creation;
  const command = sandbox.window.SplineCommand.create({ draft, scale: () => 2,
    cancelConstraintTargetCommand: () => calls.push("cancelConstraint"), cancelPendingCommand: () => calls.push("cancelPending"),
    canCreateInActiveSketch: () => allowed, rejectRootSketchCreation: () => calls.push("reject"),
    setMode: value => calls.push(value), resetEditing: () => calls.push("editReset"),
    resetBlankCandidate: () => calls.push("blankReset"), updateToolbar: () => calls.push("toolbar"),
    snapForDrawing: point => point,
    addSpline: (fitPoints, closed) => { calls.push('create'); creation = { fitPoints, closed }; return success ? spline : null; },
    clearProjectionSources: () => calls.push('projection'), setPointerPreview: () => calls.push('preview'),
    clearSnap: () => calls.push('snap'), clearSelection: () => calls.push('clearSelection'),
    selectCreatedSpline: value => { assert.equal(value, spline); calls.push('select'); },
    solveAndRefresh: () => calls.push('solve'), recordHistory: () => calls.push('history'),
    applicationText: (_ja, en) => en, setHint: () => calls.push('hint'), updateUI: () => calls.push('ui'), draw: () => calls.push('draw'),
  });
  return { command, draft, calls, points, creation: () => creation };
}
test('insufficient or invalid geometry retains the draft and does not record history', () => {
  const short = fixture(2); assert.equal(short.command.finalize(), false);
  assert.deepEqual(short.calls, ['hint']); assert.equal(short.draft.points.length, 2);
  const invalid = fixture(3, false); assert.equal(invalid.command.finalize(), false);
  assert.deepEqual(invalid.calls, ['create', 'hint']); assert.equal(invalid.draft.points.length, 3);
});
test('successful completion preserves point identities and orders selection, solve and history', () => {
  const f = fixture(); assert.equal(f.command.finalize(true), true);
  assert.notEqual(f.creation().fitPoints, f.points);
  assert.equal(f.creation().fitPoints[0], f.points[0]); assert.equal(f.creation().closed, true);
  assert.deepEqual(f.calls, ['create', 'reset', 'projection', 'preview', 'snap', 'clearSelection', 'select', 'solve', 'history', 'hint', 'ui', 'draw']);
});
test('clicking within ten screen pixels of the initial point closes without adding a point', () => {
  const f = fixture(); f.draft.add = () => assert.fail('closing must not append');
  assert.equal(f.command.click({ x: 5, y: 0 }), true);
  assert.equal(f.creation().closed, true);
});
test('failed double-click completion redraws when it discarded a point', () => {
  const f = fixture(3);
  f.draft.discardDoubleClick = (_pointer, tolerance) => {
    assert.equal(tolerance, 4); f.draft.points.pop(); return true;
  };
  assert.equal(f.command.doubleClick({ x: 50, y: 0 }), false);
  assert.deepEqual(f.calls, ['hint', 'draw']);
});

test('start cancels pending operations before root guard and leaves rejected draft untouched', () => {
  const f = fixture(3, true, false); f.draft.begin = () => assert.fail('root cannot begin');
  f.command.start(); assert.deepEqual(f.calls, ['cancelConstraint', 'cancelPending', 'reject']);
  assert.equal(f.draft.points.length, 3);
});
test('start resets editing and gesture state in order without solve or history', () => {
  const f = fixture(); f.draft.begin = () => { f.calls.push('begin'); f.draft.points = []; };
  f.command.start();
  assert.deepEqual(f.calls, ['cancelConstraint', 'cancelPending', 'spline', 'begin', 'projection', 'editReset', 'blankReset', 'preview', 'clearSelection', 'snap', 'toolbar', 'hint', 'draw']);
  assert.equal(f.draft.points.length, 0);
});
test('removeLast delegates rollback to the draft then updates authoring feedback', () => {
  const f = fixture(); f.draft.removeLast = () => { f.calls.push('remove'); f.draft.points.pop(); };
  f.command.removeLast(); assert.equal(f.draft.points.length, 2); assert.deepEqual(f.calls, ['remove', 'hint', 'draw']);
});
