const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/constraint_command_input.js'), 'utf8'), sandbox);
class Circle {} class Arc {}
function fixture() {
  const source = {}, candidate = {};
  const state = { pending: { type: 'distance-place', target: { kind: 'line-length' }, operands: [null, source] }, candidate, target: null, valid: true };
  const calls = [], updates = [];
  const hover = { current: { point: null, endpointPoint: null, line: null, circle: null, arc: null, arcEndpoint: null, dimension: null, block: {}, spline: {}, annotation: {} }, update: values => { updates.push({ ...values }); Object.assign(hover.current, values); } };
  const command = sandbox.window.ConstraintCommandInput.createRetargetHover({
    getPending: () => state.pending, canvasHover: hover, Circle, Arc,
    hitConstraintOperand: (pointer, type) => { calls.push(['hit', pointer, type]); return state.candidate; },
    sameConstraintOperand: (a, b) => { calls.push(['same', a, b]); return a === b; },
    resolveConstraintIntent: (type, operands) => { calls.push(['resolve', type, Array.from(operands)]); return { target: { kind: state.valid ? 'point-point' : 'invalid' } }; },
    referenceTargetFromOperand: operand => { calls.push(['target', operand]); return state.target; },
  });
  return { command, state, calls, updates, hover, source, candidate };
}
test('retarget hover uses one filtered operand and current pending state, preserving references and other hover fields', () => {
  const f = fixture(), point = {}, pointer = {}; f.state.target = { kind: 'point', point };
  const spline = f.hover.current.spline, annotation = f.hover.current.annotation, pending = f.state.pending;
  assert.equal(f.command.update(pointer), true);
  assert.deepEqual(f.calls, [['hit', pointer, 'distance'], ['same', f.source, f.candidate], ['resolve', 'distance', [f.source, f.candidate]], ['target', f.candidate]]);
  assert.equal(f.hover.current.point, point); assert.equal(f.hover.current.endpointPoint, point); assert.equal(f.hover.current.block, null);
  assert.equal(f.hover.current.spline, spline); assert.equal(f.hover.current.annotation, annotation); assert.equal(f.state.pending, pending);
  assert.equal(f.updates.length, 3); assert.equal(f.command.update(pointer), null);
  f.state.pending = null; f.calls.length = 0; assert.equal(f.command.update(pointer), false); assert.deepEqual(f.calls, []); assert.equal(f.hover.current.point, null);
});
test('retarget hover projects line, radius and diameter targets using injected primitive types', () => {
  for (const [kind, target, field] of [['line-length', { kind: 'line', line: {} }, 'line'], ['radius', { primitive: new Arc() }, 'arc'], ['diameter', { primitive: new Circle() }, 'circle']]) {
    const f = fixture(); f.state.pending.target.kind = kind; f.state.target = target;
    assert.equal(f.command.update({}), true); assert.equal(f.hover.current[field], target.line || target.primitive);
    assert.equal(f.hover.current.dimension, null); assert.equal(f.hover.current.arcEndpoint, null);
  }
});
test('non-retarget placement clears only primitive hover and skips operand queries', () => {
  const f = fixture(); f.state.pending.target.kind = 'point-point';
  const endpoint = {}, dimension = {}, block = f.hover.current.block;
  Object.assign(f.hover.current, { point: {}, line: {}, circle: {}, arc: {}, arcEndpoint: endpoint, dimension });
  assert.equal(f.command.update({}), false); assert.deepEqual(f.calls, []); assert.equal(f.updates.length, 1);
  assert.equal(f.hover.current.arcEndpoint, endpoint); assert.equal(f.hover.current.dimension, dimension); assert.equal(f.hover.current.block, block);
  assert.equal(f.hover.current.point, null); assert.equal(f.hover.current.endpointPoint, null);
});
test('same, absent, invalid or multiple operands cannot become provisional targets; change result retains existing sentinel', () => {
  for (const scenario of ['same', 'absent', 'invalid', 'multiple']) {
    const f = fixture();
    if (scenario === 'same') f.state.candidate = f.source;
    if (scenario === 'absent') f.state.candidate = null;
    if (scenario === 'invalid') f.state.valid = false;
    if (scenario === 'multiple') f.state.pending.operands.push({});
    const dimension = {}; f.hover.current.dimension = dimension;
    assert.equal(f.command.update({}), dimension); assert.equal(f.hover.current.dimension, null); assert.equal(f.hover.current.block, null);
    assert.equal(f.calls.some(call => call[0] === 'target'), false);
    if (scenario !== 'invalid') assert.equal(f.calls.some(call => call[0] === 'resolve'), false);
    if (scenario === 'multiple') assert.equal(f.calls.length, 0);
  }
});
