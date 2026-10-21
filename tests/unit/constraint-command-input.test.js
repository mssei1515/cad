const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/constraint_command_input.js'), 'utf8'), sandbox);
class Circle {} class Arc {}
function continuationFixture(feature = false) {
  const state = { ready: false, pending: null, target: null, retarget: false, fail: null, error: new Error('continuation failed'), pointer: { x: 8, y: 9 } }, calls = [];
  const read = (name, ...args) => { assert.equal(state.ready, true); calls.push([name, ...args]); if (state.fail === name) throw state.error; };
  const hover = { current: { dimension: {}, line: {} }, update(value) { assert.equal(this, hover); read('hover', value); Object.assign(hover.current, value); } };
  const pending = { get current() { read('pending'); return state.pending; }, read: function() { 'use strict'; assert.equal(this, undefined); read('pending'); return state.pending; } }, targets = { get command() { read('targets'); return state.target; } };
  const placement = { retargetDistancePlaceWithOperand(pointer, hits) { assert.equal(this, placement); read('retarget', pointer, hits); return state.retarget; },
    startDistanceValueInput(pointer) { assert.equal(this, placement); read('value', pointer); } };
  const constraints = { operandClick(pointer, type, hits) { assert.equal(this, constraints); read('operand', pointer, type, hits); } };
  const factory = feature ? sandbox.window.ConstraintCommandInput.createFeature : sandbox.window.ConstraintCommandInput.createDimensionContinuation;
  const api = factory({ canvasHover: hover, pending, targets, placement, constraints,
    canvasPoint: function(event) { 'use strict'; assert.equal(this, undefined); read('point', event); return state.pointer; } });
  assert.deepEqual(calls, []); state.ready = true;
  return { api, state, calls, hover, names: () => calls.map(c => c[0]) };
}

function featureFixture() {
  const f = continuationFixture(true), selection = { clear: () => f.calls.push(['clear']), effectiveSelectedConstraint: () => null };
  f.state.ready = false;
  const input = f.api.createInput({ canvasSelection: selection,
    dragging: { selectedLineGroup: function(constraint) { 'use strict'; assert.equal(this, undefined); f.calls.push(['group', constraint]); return f.state.group; },
      command: { begin: function() { 'use strict'; assert.equal(this, undefined); f.calls.push(['drag', ...arguments]); } } },
    constraintTargetHint: type => type, setHint: value => f.calls.push(['hint', value]),
    updateGeometrySelectionUI: () => f.calls.push(['ui']), draw: () => f.calls.push(['draw']),
  });
  assert.deepEqual(f.calls, []); f.state.ready = true;
  const event = { preventDefault: () => f.calls.push(['prevent']) };
  return { ...f, input, selection, event };
}

test('constraint feature shares live command owners across staged input and dimension continuation without construction reads', () => {
  const f = featureFixture(), pointer = {}, point = {}, hits = { hitP: point };
  assert.ok(Object.isFrozen(f.api)); assert.ok(Object.isFrozen(f.api.dimension)); assert.ok(Object.isFrozen(f.input));
  f.state.pending = { type: 'distance-place' }; f.state.target = { type: 'distance' };
  assert.equal(f.api.dimension.isActive(), true); f.calls.length = 0;
  assert.equal(f.input.click(f.event, pointer, hits), true);
  assert.deepEqual(f.names(), ['pending', 'prevent', 'retarget', 'value']);
  assert.equal(f.calls[2][1], pointer); assert.equal(f.calls[2][2].hitP, point); assert.equal(f.calls[3][1], pointer);
  f.calls.length = 0; f.state.retarget = true; f.input.click(f.event, pointer, hits);
  assert.deepEqual(f.names(), ['pending', 'prevent', 'retarget']);
  f.calls.length = 0; f.state.pending = null; f.state.target = { type: 'horizontal' };
  assert.equal(f.input.click(f.event, pointer, hits), true);
  const operand = f.calls.find(call => call[0] === 'operand');
  assert.equal(operand[1], pointer); assert.equal(operand[2], 'horizontal'); assert.equal(operand[3].hitP, point);
  f.calls.length = 0; f.state.target = { type: 'distance' }; f.api.dimension.continueClick(f.event, hits);
  assert.deepEqual(f.names(), ['hover', 'point', 'pending', 'targets', 'operand']); assert.equal(f.calls.at(-1)[3], hits);
});

test('staged constraint input retains group selection and original drag functions, and propagates command failure', () => {
  const f = featureFixture(), constraint = {}, hitD = { constraint }, pointer = {};
  f.state.group = {}; f.input.click(f.event, pointer, { hitD });
  assert.equal(f.names().includes('clear'), false); assert.equal(f.calls.find(call => call[0] === 'group')[1], constraint);
  const drag = f.calls.find(call => call[0] === 'drag'); assert.equal(drag[1], f.event); assert.equal(drag[2], hitD); assert.equal(drag[3], pointer);
  f.calls.length = 0; f.state.group = null; f.input.click(f.event, pointer, { hitD });
  assert.ok(f.names().indexOf('clear') < f.names().indexOf('drag'));
  f.calls.length = 0; f.state.pending = { type: 'distance-place' }; f.state.fail = 'retarget';
  assert.throws(() => f.input.click(f.event, pointer, {}), error => error === f.state.error);
  assert.deepEqual(f.names(), ['pending', 'prevent', 'retarget']);
  f.calls.length = 0; f.state.fail = null; f.state.pending = { type: 'offset-value' };
  assert.equal(f.input.click(f.event, pointer, {}), true); assert.equal(f.names().includes('value'), false);
});

test('dimension continuation reads current command state lazily and keeps predicate short circuits', () => {
  const f = continuationFixture(); assert.ok(Object.isFrozen(f.api));
  for (const target of [null, { type: 'horizontal' }]) {
    f.state.target = target; f.calls.length = 0; assert.equal(f.api.isActive(), false); assert.deepEqual(f.names(), ['targets']);
  }
  f.state.target = { type: 'distance' };
  for (const [pending, expected] of [[null, true], [{ type: 'distance-place' }, true], [{ type: 'distance-value' }, false], [{ type: 'offset-value' }, true]]) {
    f.state.pending = pending; f.calls.length = 0; assert.equal(f.api.isActive(), expected); assert.deepEqual(f.names(), ['targets', 'pending']);
  }
  f.state.fail = 'targets'; assert.throws(() => f.api.isActive(), error => error === f.state.error);
});

test('dimension continuation clears hover before pointer conversion and preserves placement priority, defaults and live targets', () => {
  const f = continuationFixture(), event = {}, hits = Object.freeze({ hitP: {} }), line = f.hover.current.line;
  f.state.pending = { type: 'distance-place' }; f.state.target = { type: 'distance' }; f.state.retarget = true;
  assert.equal(f.api.continueClick(event, hits), undefined); assert.deepEqual(f.names(), ['hover', 'point', 'pending', 'retarget']);
  assert.equal(f.calls[3][1], f.state.pointer); assert.equal(f.calls[3][2], hits); assert.equal(f.hover.current.dimension, null); assert.equal(f.hover.current.line, line);
  f.calls.length = 0; f.state.retarget = false; f.api.continueClick(event);
  assert.deepEqual(f.names(), ['hover', 'point', 'pending', 'retarget', 'value']); const firstDefault = f.calls[3][2]; assert.deepEqual(Object.keys(firstDefault), []); assert.equal(f.calls[4][1], f.state.pointer);
  f.calls.length = 0; f.api.continueClick(event); assert.notEqual(f.calls[3][2], firstDefault);
  f.calls.length = 0; f.api.continueClick(event, null); assert.equal(f.calls[3][2], null);
  f.state.pending = null; f.calls.length = 0; f.api.continueClick(event, hits);
  assert.deepEqual(f.names(), ['hover', 'point', 'pending', 'targets', 'operand']); assert.equal(f.calls[4][1], f.state.pointer); assert.equal(f.calls[4][2], 'distance'); assert.equal(f.calls[4][3], hits);
  f.calls.length = 0; f.api.continueClick(event); assert.deepEqual(Object.keys(f.calls[4][3]), []);
  f.calls.length = 0; f.api.continueClick(event, null); assert.equal(f.calls[4][3], null);
  f.state.target = { type: 'horizontal' }; f.calls.length = 0; f.api.continueClick(event, hits); assert.deepEqual(f.names(), ['hover', 'point', 'pending', 'targets']);
});

test('dimension continuation propagates each failure at its original boundary without clearing other hover fields', () => {
  for (const [failure, expected] of [['point', ['hover', 'point']], ['pending', ['hover', 'point', 'pending']], ['retarget', ['hover', 'point', 'pending', 'retarget']], ['value', ['hover', 'point', 'pending', 'retarget', 'value']], ['operand', ['hover', 'point', 'pending', 'targets', 'operand']]]) {
    const f = continuationFixture(), line = f.hover.current.line;
    f.state.pending = failure === 'operand' ? null : { type: 'distance-place' }; f.state.target = { type: 'distance' }; f.state.fail = failure;
    assert.throws(() => f.api.continueClick({}, {}), error => error === f.state.error); assert.deepEqual(f.names(), expected);
    assert.equal(f.hover.current.dimension, null); assert.equal(f.hover.current.line, line);
    f.state.fail = null; f.calls.length = 0; f.api.continueClick({}, {}); assert.ok(f.names().includes(failure === 'operand' ? 'operand' : 'value'));
  }
});

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
