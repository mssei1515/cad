const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/fixed_toggle_command.js'), 'utf8'), sandbox);
const { FixedToggleCommand } = sandbox.window;
class LineFixedConstraint { constructor(line) { this.line = line; } }
class ArcEndpointFixedConstraint { constructor(arc, endpoint, x, y) { Object.assign(this, { arc, endpoint, x, y }); } }
class GeometryFixedConstraint { constructor(geometry) { this.geometry = geometry; } }
function fixture() {
  const f = { calls: [], selection: { points: [], lines: [], circles: [], arcs: [], splines: [], blockInstances: [], arcEndpoint: null },
    scope: { constraints: [] }, allowed: true, projectionAllowed: true, commit: true, deleted: false, fullyFixed: false,
    solved: { success: true, result: { success: true, errorNorm: 0 } } };
  const record = name => (...args) => f.calls.push([name, ...args]);
  const ports = {
    guardSketchEdit: () => f.allowed, elementSketchId: () => 'S2', operandElement: operand => operand.element,
    guardSelectionEdit: () => f.allowed, canvasSelection: f.selection,
    guardSketchProjectionShapeEdit: () => f.projectionAllowed, applicationText: (ja, en) => en,
    findLineFixedConstraint: line => f.scope.constraints.find(item => item instanceof LineFixedConstraint && item.line === line),
    findArcEndpointFixedConstraint: (arc, endpoint) => f.scope.constraints.find(item => item instanceof ArcEndpointFixedConstraint && item.arc === arc && item.endpoint === endpoint),
    arcEndpointPoint: (arc, endpoint) => { f.calls.push(['endpoint']); return arc[endpoint]; },
    LineFixedConstraint, ArcEndpointFixedConstraint, GeometryFixedConstraint, currentScope: () => f.scope,
    sameConstraintDisplayElement: (a, b) => a === b,
    deleteElements: options => { f.calls.push(['delete', options]); return f.deleted; },
    commitNewConstraint: (type, constraint) => { f.calls.push(['commit', type, constraint]); return f.commit; },
    blockDefinitionById: () => null, setHint: record('hint'), clearSelection: record('clear'), updateUI: record('ui'),
    draw: record('draw'), recordHistory: record('history'), log: record('log'),
    selectedFixedBatchTargets: () => f.batch, fixedBatchIsFullyFixed: () => f.fullyFixed,
    snapshotModelState: () => { f.calls.push(['snapshot']); return { constraints: f.scope.constraints.slice(), values: f.selection.points.map(point => [point, point.fixed]) }; },
    restoreModelState: snapshot => { f.calls.push(['restore', snapshot]); f.scope.constraints.splice(0, f.scope.constraints.length, ...snapshot.constraints); for (const [point, fixed] of snapshot.values) point.fixed = fixed; },
    pushModelConstraint: (constraint, id) => { f.calls.push(['push', constraint, id]); f.scope.constraints.push(constraint); },
    solveSketchAndDependents: (id, snapshot) => { f.calls.push(['solve', id, snapshot]); return f.solved; },
    acceptError: 1e-4, refreshConstraintAnalysis: record('analysis'),
  };
  f.operand = FixedToggleCommand.createOperand(ports); f.command = FixedToggleCommand.createSelection(ports);
  return f;
}

test('operand toggles use live constraints, preserve enabled filtering and delegate exact return values', () => {
  const f = fixture(), geometry = {}, disabled = new GeometryFixedConstraint(geometry), existing = new GeometryFixedConstraint(geometry);
  disabled.enabled = false; f.scope = { constraints: [disabled, existing] };
  assert.equal(f.operand.toggle({ kind: 'circle', element: geometry }), false);
  assert.equal(f.calls[0][1].constraints[0], existing);
  f.calls.length = 0; f.scope = { constraints: [disabled] };
  assert.equal(f.operand.toggle({ kind: 'circle', element: geometry }), true);
  assert.equal(f.calls[0][2].geometry, geometry);
  f.calls.length = 0; f.allowed = false;
  assert.equal(f.operand.toggle({ kind: 'circle', element: geometry }), false);
  assert.equal(f.calls.length, 0);
});

test('single-instance projected selection toggles its host without mutating local geometry or solving', () => {
  const f = fixture(), instance = { id: 'BI1', fixed: false }, point = { fixed: false, blockProjection: true, blockInstance: instance }, line = { blockProjection: true, blockInstance: instance };
  f.selection.points.push(point); f.selection.lines.push(line);
  assert.equal(f.command.toggle(), true);
  assert.equal(instance.fixed, true); assert.equal(point.fixed, false);
  assert.deepEqual(f.calls.map(call => call[0]), ['hint', 'clear', 'ui', 'draw', 'history']);
  f.calls.length = 0; f.selection.lines.push({});
  assert.equal(f.command.toggle(), false);
  assert.equal(instance.fixed, true);
  assert.equal(f.calls.length, 0);
});

test('selected endpoint preserves legacy unfix result and restores a failed new commit before displaying', () => {
  const f = fixture(), arc = { id: 'A1', end: { x: 7, y: 9 } };
  f.selection.arcEndpoint = { arc, endpoint: 'end' };
  const existing = new ArcEndpointFixedConstraint(arc, 'end', 7, 9); f.scope.constraints.push(existing);
  assert.equal(f.command.toggle(), true);
  assert.equal(f.calls[0][1].constraints[0], existing);
  assert.deepEqual(f.calls.map(call => call[0]), ['delete', 'log']);
  f.calls.length = 0; f.scope.constraints.length = 0; f.commit = false;
  assert.equal(f.command.toggle(), false);
  assert.deepEqual(f.calls.map(call => call[0]), ['endpoint', 'snapshot', 'commit', 'restore', 'ui', 'draw']);
  assert.equal(f.calls[2][2].arc, arc); assert.equal(f.calls[2][2].endpoint, 'end');
  assert.equal(f.calls[2][2].x, 7); assert.equal(f.calls[2][2].y, 9);
});

test('batch root failure, dependent failure and unacceptable error restore flags and constraints without history', () => {
  for (const solved of [
    { success: false, result: { errorNorm: 0 } },
    { success: true, result: { errorNorm: 0 }, dependent: { success: false } },
    { success: true, result: { errorNorm: 0.001 } },
  ]) {
    const f = fixture(), point = { id: 'P1', fixed: false }, line = { id: 'L1' }, original = {};
    f.selection.points.push(point); f.batch = { points: [point], lines: [line], sketchId: 'S2' }; f.scope.constraints.push(original); f.solved = solved;
    assert.equal(f.command.toggle(), false);
    assert.equal(point.fixed, false); assert.equal(f.scope.constraints.length, 1); assert.equal(f.scope.constraints[0], original);
    assert.deepEqual(f.calls.map(call => call[0]), ['snapshot', 'push', 'solve', 'restore', 'hint', 'ui', 'draw']);
    assert.equal(f.calls[1][1].line, line); assert.equal(f.calls[1][2], 'S2');
    assert.equal(f.calls[2][2], f.calls[3][1]);
  }
});

test('batch unfix removes only matched fixed constraints and records history after accepted dependent solve', () => {
  const f = fixture(), point = { id: 'P1', fixed: true }, line = { id: 'L1' }, otherLine = {}, unrelated = {};
  const removed = new LineFixedConstraint(line), retained = new LineFixedConstraint(otherLine);
  f.selection.points.push(point); f.batch = { points: [point], lines: [line], sketchId: 'S2' }; f.fullyFixed = true;
  f.scope.constraints.push(unrelated, removed, retained);
  const originalArray = f.scope.constraints;
  assert.equal(f.command.toggle(), true);
  assert.equal(point.fixed, false); assert.equal(f.scope.constraints, originalArray);
  assert.deepEqual(f.scope.constraints, [unrelated, retained]);
  assert.deepEqual(f.calls.map(call => call[0]), ['snapshot', 'solve', 'analysis', 'hint', 'ui', 'draw', 'log', 'history']);
  assert.equal(f.calls[4][1].refreshAnalysis, false);
  assert.equal(f.calls.at(-1)[1], '固定状態変更');
});
