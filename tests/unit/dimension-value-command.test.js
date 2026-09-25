const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/dimension_value_command.js'), 'utf8'), sandbox);
function fixture({ existing = false, success = true, value = 25, added = true } = {}) {
  const constraint = { expression: '10' }, calls = [];
  let pending = { type: 'distance-value', target: {}, buffer: '25', dimension: {}, constraint: existing ? constraint : null };
  const command = sandbox.window.DimensionValueCommand.create({
    getPending: () => pending, setPending: p => { pending = p; calls.push('clear'); },
    expressionFromUserInput: value => value, evaluateDimensionExpressionDraft: () => { if (value instanceof Error) throw value; return value; },
    applicationText: (_ja, en) => en, parameterErrorText: error => error.message,
    setHint: () => calls.push('hint'), syncDimensionValueInput: () => calls.push('sync'), draw: () => calls.push('draw'),
    activeSketchId: () => 'S1', constraintSketchId: () => 'S1', sketchHasDimensionConstraint: () => false,
    captureSketchScreenFootprint: () => { calls.push('footprint'); return {}; },
    snapshotModelState: () => constraint.expression, restoreModelState: expression => { constraint.expression = expression; calls.push('restore'); },
    withTemporarySolveStepNorm: (_norm, run) => run(), solveStepNormForConstraint: () => 1,
    stabilizeActiveParameterNamespace: () => ({ success, result: { errorNorm: 0 } }), acceptError: 1e-4,
    hideDimensionValueInput: () => calls.push('hide'), recordHistory: () => calls.push('history'), updateUI: () => calls.push('ui'),
    scaleSketchForFirstDimension: () => calls.push('scale'), addDistanceConstraintFromTarget: () => { calls.push('add'); return added; },
    restoreSketchScreenFootprint: () => { calls.push('frame'); return true; },
  });
  return { command, calls, constraint, pending: () => pending };
}
test('failed existing dimension update restores the expression and keeps input open', () => {
  const f = fixture({ existing: true, success: false }); f.command.submit();
  assert.equal(f.constraint.expression, '10'); assert.ok(f.pending());
  assert.deepEqual(f.calls, ['restore', 'hint', 'sync', 'ui', 'draw']);
});
test('successful update clears input and records history before UI refresh', () => {
  const f = fixture({ existing: true }); f.command.submit();
  assert.equal(f.constraint.expression, '25'); assert.equal(f.pending(), null);
  assert.deepEqual(f.calls, ['clear', 'hide', 'hint', 'history', 'ui', 'draw']);
});
test('first dimension scales before insertion and restores framing only after acceptance', () => {
  const f = fixture(); f.command.submit();
  assert.deepEqual(f.calls, ['footprint', 'scale', 'add', 'clear', 'hide', 'frame', 'hint', 'draw']);
  const rejected = fixture({ added: false }); rejected.command.submit();
  assert.deepEqual(rejected.calls, ['footprint', 'scale', 'add']); assert.ok(rejected.pending());
});
test('evaluation errors and out-of-range values keep input and skip model operations', () => {
  const error = fixture({ value: new Error('invalid') }); error.command.submit();
  assert.deepEqual(error.calls, ['hint', 'sync', 'draw']);
  for (const value of [0, -1, NaN, Infinity]) {
    const f = fixture({ value }); f.command.submit(); assert.deepEqual(f.calls, ['hint', 'draw']); assert.ok(f.pending());
  }
  const angle = fixture({ value: 180 }); angle.pending().target.kind = 'angle'; angle.command.submit();
  assert.deepEqual(angle.calls, ['hint', 'draw']);
});
