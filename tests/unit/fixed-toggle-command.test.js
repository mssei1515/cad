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
function fixture(configurePorts = ports => ports) {
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
  const configured = configurePorts(ports, f);
  f.operand = FixedToggleCommand.createOperand(configured); f.command = FixedToggleCommand.createSelection(configured);
  return f;
}

test('point unfix uses live ownership and guard before updating the original point and requesting the existing solve', () => {
  const point = { id: 'P1', sketchId: 'S2', fixed: true }, calls = []; let allowed = false;
  const command = FixedToggleCommand.createOperand({
    elementSketchId: item => { assert.equal(item, point); calls.push('owner'); return item.sketchId; },
    guardSketchEdit: (id, operation) => { calls.push(['guard', id, operation]); return allowed; },
    solveAndRefresh: function(label) { 'use strict'; assert.equal(this, undefined); assert.equal(point.fixed, false);
      assert.equal(arguments.length, 1); calls.push(['solve', label]); return false; },
  });
  assert.deepEqual(calls, []); assert.equal(command.unfixPoint(point), undefined); assert.equal(point.fixed, true);
  assert.deepEqual(calls, ['owner', ['guard','S2','constraint']]);
  allowed = true; point.sketchId = 'S3'; calls.length = 0;
  assert.equal(command.unfixPoint(point), undefined); assert.equal(point.fixed, false);
  assert.deepEqual(calls, ['owner', ['guard','S3','constraint'], ['solve','固定解除 P1']]);
  calls.length = 0; command.unfixPoint(point); assert.equal(calls.filter(row => row[0] === 'solve').length, 1);
});

test('point unfix propagates failures and preserves the established mutation boundary without extra recovery', () => {
  const marker = new Error('unfix failed'); let stage = 'owner', solves = 0;
  const command = FixedToggleCommand.createOperand({ elementSketchId: point => { if (stage === 'owner') throw marker; return point.sketchId; },
    guardSketchEdit: () => { if (stage === 'guard') throw marker; return true; },
    solveAndRefresh: () => { solves++; throw marker; } });
  for (stage of ['owner','guard','solve']) {
    const point = { id: 'P1', sketchId: 'S1', fixed: true };
    assert.throws(() => command.unfixPoint(point), error => error === marker);
    assert.equal(point.fixed, stage !== 'solve');
  }
  assert.equal(solves, 1);
});

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

const modelSandbox = { window: {} }; vm.createContext(modelSandbox);
for (const file of ['src/geometry/geometry_kernel.js','src/geometry/spline_geometry.js','src/solver/constraint_solver.js',
  'src/ui/toolbar_view.js','src/testing/properties_test_driver.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), modelSandbox, { filename: file });
const modelWindow = modelSandbox.window, models = modelWindow.GeometrySolver;
function typedFixture() {
  return fixture((ports, f) => {
    const configured = { ...ports, modelTypes: { ...models },
      findLineFixedConstraint: line => f.scope.constraints.find(item => item instanceof models.LineFixedConstraint && item.line === line),
      findArcEndpointFixedConstraint: (arc, endpoint) => f.scope.constraints.find(item => item instanceof models.ArcEndpointFixedConstraint && item.arc === arc && item.endpoint === endpoint),
      arcEndpointPoint: modelWindow.GeometryKernel.arcEndpointPoint };
    for (const name of ['LineFixedConstraint','ArcEndpointFixedConstraint','GeometryFixedConstraint']) delete configured[name];
    f.types = configured.modelTypes; f.findLine = configured.findLineFixedConstraint; return configured;
  });
}

test('model namespace shares actual fixed constructors across operand, batch, icon and observation without live type lookup', () => {
  const f = typedFixture(), dom = [];
  const icons = modelWindow.ToolbarView.createIcons({ types: f.types, isDimensionConstraint: () => false,
    document: { querySelector: selector => { dom.push(selector); return { querySelector: () => ({ outerHTML: `<svg data-button="${selector}"></svg>` }) }; } } });
  const observation = modelWindow.PropertiesTestDriver.createFixedObservation({ modelTypes: f.types, currentScope: () => f.scope,
    elementSketchId: item => item.sketchId, findLineFixedConstraint: f.findLine, fixPointBtn: { getAttribute: () => 'false' }, readHistory: () => ({ undoCount: 1 }) });
  assert.deepEqual(f.calls, []); assert.deepEqual(dom, []);
  for (const name of ['LineFixedConstraint','ArcEndpointFixedConstraint','GeometryFixedConstraint']) Object.defineProperty(f.types, name, { get: () => assert.fail('type lookup after construction') });
  const p1 = Object.assign(new models.Point('P1', 0, 0), { sketchId: 'S2' }), p2 = Object.assign(new models.Point('P2', 20, 10), { sketchId: 'S2' });
  const line = Object.assign(new models.Line('L1', p1, p2), { sketchId: 'S2' }), circle = new models.Circle('C1', p1, 5), arc = new models.Arc('A1', p1, 10, 0, Math.PI / 2);
  f.scope.points = [p1,p2]; f.scope.lines = [line];
  for (const [kind, element, Type] of [['line',line,models.LineFixedConstraint],['circle',circle,models.GeometryFixedConstraint],['arc-endpoint',arc,models.ArcEndpointFixedConstraint]]) {
    f.calls.length = 0; assert.equal(f.operand.toggle({ kind, element, endpoint: 'start' }), true);
    const fixed = f.calls.find(call => call[0] === 'commit')[2]; assert.equal(fixed instanceof Type, true);
    assert.equal(fixed.line || fixed.geometry || fixed.arc, element); f.scope.constraints.push(fixed);
    assert.match(icons.constraintToolbarIcon(fixed), /#fixPointBtn/);
  }
  const next = Object.assign(new models.Line('L2', p1, p2), { sketchId: 'S2' }); f.scope.lines.push(next);
  f.batch = { points: [], lines: [next], sketchId: 'S2' }; f.calls.length = 0;
  assert.equal(f.command.toggle(), true); assert.equal(f.calls.filter(call => call[0] === 'history').length, 1);
  assert.equal(f.scope.constraints.at(-1) instanceof models.LineFixedConstraint, true); assert.equal(f.scope.constraints.at(-1).line, next);
  const state = observation.state(); assert.deepEqual(Array.from(state.fixedLineIds), ['L1','L2']); assert.equal(state.constraintCount, 2);
  assert.equal(f.scope.lines[0], line); assert.equal(f.scope.points[0], p1);
});

test('explicit fixed constructors override a namespace and failed typed batches keep original objects and history unchanged', () => {
  const explicit = fixture(ports => ({ ...ports, modelTypes: new Proxy({}, { get: () => assert.fail('explicit constructor must win') }) }));
  const line = { id: 'L1' }; assert.equal(explicit.operand.toggle({ kind: 'line', element: line }), true);
  assert.equal(explicit.calls[0][2] instanceof LineFixedConstraint, true);
  const observation = modelWindow.PropertiesTestDriver.createFixedObservation({ modelTypes: new Proxy({}, { get: () => assert.fail('explicit observation type must win') }),
    LineFixedConstraint, currentScope: () => ({ points: [], lines: [], constraints: [new LineFixedConstraint(line)] }),
    elementSketchId: () => 'S2', findLineFixedConstraint: () => null, fixPointBtn: { getAttribute: () => 'false' }, readHistory: () => ({}) });
  assert.equal(observation.state().constraintCount, 1);
  const f = typedFixture(), point = new models.Point('P1', 0, 0), other = new models.Point('P2', 10, 20), typedLine = new models.Line('L2', point, other), original = {};
  point.fixed = false; f.selection.points.push(point); f.batch = { points: [point], lines: [typedLine], sketchId: 'S2' };
  f.scope.constraints.push(original); const constraints = f.scope.constraints; f.solved = { success: false, result: { errorNorm: 1 } };
  assert.equal(f.command.toggle(), false); assert.equal(point.fixed, false); assert.equal(f.scope.constraints, constraints); assert.deepEqual(constraints, [original]);
  assert.equal(f.calls.find(call => call[0] === 'push')[1] instanceof models.LineFixedConstraint, true);
  assert.equal(f.calls.some(call => call[0] === 'restore'), true); assert.equal(f.calls.some(call => call[0] === 'history'), false);
});
