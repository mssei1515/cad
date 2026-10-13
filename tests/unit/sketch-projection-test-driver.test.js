const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
sandbox.structuredClone = structuredClone;
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/sketch_projection_test_driver.js'), 'utf8'), sandbox);
class Point { constructor(id, x = 10, y = 20) { Object.assign(this, { id, x, y }); } }
class Line { constructor(id) { Object.assign(this, { id, p1: new Point('a', 0, 0), p2: new Point('b', 20, 40) }); } }
class Circle { constructor(id) { Object.assign(this, { id, center: new Point('c') }); } }
class Arc { constructor(id) { Object.assign(this, { id, center: new Point('c') }); } }
class Spline { constructor(id) { Object.assign(this, { id, fitPoints: [new Point('f1'), new Point('f2')] }); } }
function fixture() {
  const calls = [], state = { constraints: [], result: false, scope: 'original' };
  const command = sandbox.window.SketchProjectionTestDriver.createGeometryInteraction({
    types: { Point, Line, Circle, Arc, Spline },
    readConstraints: () => { calls.push(['constraints']); return state.constraints; },
    clearSelection: () => calls.push(['clear']),
    canvasSelection: { set: (kind, items) => calls.push(['selection', kind, items]) },
    updateUI: () => calls.push(['ui']), draw: () => calls.push(['draw']),
    readState: () => { calls.push(['state']); return { propertiesText: state.scope }; },
    clientPosition: point => { calls.push(['client', point]); return point; },
    constraintGeometryId: item => item.id,
    setAppearanceForSelection: patch => { calls.push(['appearance', patch]); state.scope = 'after appearance'; return state.result; },
    deleteElements: payload => { calls.push(['delete', payload]); return state.result; },
    deleteCurrentSelection: () => { calls.push(['delete selection']); state.scope = 'after deletion'; return state.result; },
    deleteSketch: (id, force) => { calls.push(['delete sketch', id, force]); state.scope = 'after sketch deletion'; return state.result; },
    DEFAULT_SKETCH_ID: 'source-sketch',
  });
  return { command, calls, state };
}
test('selection retains geometry references for every type and reads display state after repaint', () => {
  for (const [kind, Type, collection] of [['point', Point, 'points'], ['line', Line, 'lines'], ['circle', Circle, 'circles'], ['arc', Arc, 'arcs'], ['spline', Spline, 'splines']]) {
    const f = fixture(), target = new Type('target'); f.state.constraints = [{ kind, target }];
    const selected = f.command.select(kind);
    assert.equal(f.calls[2][1], collection); assert.equal(f.calls[2][2][0], target);
    assert.deepEqual(f.calls.slice(3, 6), [['ui'], ['draw'], ['state']]);
    assert.equal(selected.targetId, 'target'); assert.equal(selected.propertiesText, 'original');
    assert.deepEqual({ x: selected.client.x, y: selected.client.y }, { x: 10, y: 20 });
    f.state.constraints = []; f.calls.length = 0;
    assert.equal(f.command.select(kind), null); assert.deepEqual(f.calls, [['constraints']]);
  }
});
test('appearance keeps rejection result and observes state after the delegated edit', () => {
  const f = fixture(); f.state.constraints = [{ kind: 'line', target: new Line('target') }];
  const result = f.command.setAppearance();
  assert.equal(result.changed, false); assert.equal(result.before, 1); assert.equal(result.state.propertiesText, 'after appearance');
  assert.equal(f.calls.at(-2)[0], 'appearance'); assert.equal(f.calls.at(-1)[0], 'state');
});
test('source and constraint deletion pass original references and preserve refusal results', () => {
  for (const [kind, Type, collection] of [['point', Point, 'points'], ['line', Line, 'lines'], ['circle', Circle, 'circles'], ['arc', Arc, 'arcs'], ['spline', Spline, 'splines']]) {
    const f = fixture(), source = new Type('source'), constraint = { kind, source }; f.state.constraints = [constraint];
    assert.equal(f.command.deleteSource(kind), false); assert.equal(f.calls.at(-1)[1][collection][0], source);
    assert.equal(f.command.removeConstraint(), false); assert.equal(f.calls.at(-1)[1].constraints[0], constraint);
    f.state.constraints = []; f.calls.length = 0;
    assert.equal(f.command.deleteSource(kind), false); assert.equal(f.command.removeConstraint(), false);
    assert.deepEqual(f.calls, [['constraints'], ['constraints']]);
  }
});
test('target and sketch deletion observe current state after delegated operations', () => {
  const f = fixture(); f.state.constraints = [{ kind: 'line', target: new Line('target') }];
  assert.equal(f.command.deleteTarget().state.propertiesText, 'after deletion');
  assert.deepEqual(f.calls.slice(-2), [['delete selection'], ['state']]);
  const result = f.command.deleteSourceSketch();
  assert.equal(result.deleted, false); assert.equal(result.state.propertiesText, 'after sketch deletion');
  assert.deepEqual(f.calls.slice(-2), [['delete sketch', 'source-sketch', false], ['state']]);
});

test('reload clones saved data, converts version and observes replacement only after load and repaint', () => {
  const saved = { version: 24, points: [{ id: 'point', x: 10 }] }, calls = [];
  let loaded, fail = false;
  const command = sandbox.window.SketchProjectionTestDriver.createReload({ CURRENT_JSON_VERSION: 24,
    serializeModel: () => saved,
    loadModelData: data => { calls.push('load'); loaded = data; if (fail) throw new Error('load failed'); },
    updateUI: () => calls.push('ui'), draw: () => calls.push('draw'),
    readState: () => { calls.push('state'); return loaded; },
  });
  const result = command.reload('19');
  assert.equal(result.version, 19); assert.notEqual(result.points[0], saved.points[0]); assert.equal(saved.version, 24);
  assert.deepEqual(calls, ['load', 'ui', 'draw', 'state']);
  calls.length = 0; fail = true;
  assert.throws(() => command.reload(), /load failed/); assert.deepEqual(calls, ['load']);
});

test('transfer skips paste on copy refusal and observes live post-paste constraints and payload', () => {
  const calls = [], state = { selected: true, copied: false, constraints: [{}] }, clipboardSession = { payload: null };
  const command = sandbox.window.SketchProjectionTestDriver.createTransfer({
    select: () => state.selected ? {} : null, readConstraints: () => state.constraints,
    copySelectionToClipboard: () => { calls.push('copy'); return state.copied; },
    pasteGeometryClipboard: () => { calls.push('paste'); state.constraints.push({}); clipboardSession.payload = { constraints: [{ type: 'sketchProjection' }, { type: 'distance' }] }; return {}; },
    clipboardSession, readState: () => { calls.push('state'); return state.constraints.length; },
  });
  state.selected = false; assert.equal(command.copyAndPaste(), null); assert.deepEqual(calls, []);
  state.selected = true; assert.equal(command.copyAndPaste().pasted, false); assert.deepEqual(calls, ['copy', 'state']);
  calls.length = 0; state.copied = true;
  const result = command.copyAndPaste();
  assert.equal(result.before, 1); assert.equal(result.after, 2); assert.equal(result.pasted, true);
  assert.equal(result.clipboardProjectionCount, 1); assert.equal(result.state, 2);
  assert.deepEqual(calls, ['copy', 'paste', 'state']);
});

test('block transfer preserves selection references and returns validation errors before creating a definition', () => {
  class Projection {}
  const center = { x: 3, y: 4 }, selection = { externalConstraints: [new Projection(), {}] }, calls = [];
  const command = sandbox.window.SketchProjectionTestDriver.createTransfer({
    select: () => ({}), blockSelectionGeometry: () => selection, SketchProjectionConstraint: Projection,
    blockSelectionBoundsCenter: value => { assert.equal(value, selection); return center; },
    createBlockDefinitionFromSelection: (value, origin, name) => {
      assert.equal(value, selection); assert.equal(origin, center); assert.equal(name, 'Projected Geometry Block'); calls.push('create');
      return { constraints: [new Projection(), {}], lines: [{}], circles: [{}], arcs: [], splines: [{}] };
    },
  });
  selection.error = 'invalid'; assert.equal(command.blockize().error, 'invalid'); assert.deepEqual(calls, []);
  delete selection.error; const result = command.blockize();
  assert.equal(result.error, null); assert.equal(result.geometryCount, 3);
  assert.equal(result.projectionConstraintCount, 1); assert.equal(result.externalProjectionCount, 1);
  assert.deepEqual(calls, ['create']);
});

test('legacy target construction creates independent Sketch-owned points before geometry and preserves source values/flags', () => {
  const calls = [], points = [], geometry = []; let seq = 0;
  const create = type => (...args) => { const target = { id: type + ++seq, type, args }; calls.push(type); geometry.push(target); return target; };
  const api = sandbox.window.SketchProjectionTestDriver.createLegacyTargetConstruction({
    addPointToSketch: (x, y, sketchId, kind) => { const p = { id: 'P' + ++seq, x, y, sketchId, kind }; calls.push('point'); points.push(p); return p; },
    addLine: create('line'), addCircle: create('circle'), addArc: create('arc'), addSpline: create('spline'),
  });
  const p1 = { x: 1, y: 2, kind: 'center' }, p2 = { x: 3, y: 4 }, source = { p1, p2, center: p1, fitPoints: [p1, p2], construction: true, closed: true, startAngle: 2, endAngle: -1, radius() { calls.push('radius'); return 12; } };
  const before = JSON.stringify(source);
  let result = api.createSketchProjectionTarget({ kind: 'point', item: p1 }, 'target'); assert.notEqual(result, p1); assert.equal(result.kind, 'center'); assert.equal(result.sketchId, 'target');
  calls.length = 0; result = api.createSketchProjectionTarget({ kind: 'line', item: source }, 'target'); assert.deepEqual(calls, ['point', 'point', 'line']);
  assert.equal(result.args[0], points.at(-2)); assert.equal(result.args[1], points.at(-1)); assert.notEqual(result.args[0], p1); assert.notEqual(result.args[1], p2); assert.equal(result.args[1].kind, 'endpoint'); assert.equal(result.args[2], true);
  calls.length = 0; result = api.createSketchProjectionTarget({ kind: 'circle', item: source }, 'circle-target'); assert.deepEqual(calls, ['point', 'radius', 'circle']); assert.equal(result.args[0], points.at(-1)); assert.equal(result.args[0].sketchId, 'circle-target'); assert.equal(result.args[1], 12); assert.equal(result.args[2], true);
  calls.length = 0; result = api.createSketchProjectionTarget({ kind: 'arc', item: source }, 'target'); assert.deepEqual(calls, ['point', 'radius', 'arc']); assert.equal(result.args[2], 2); assert.equal(result.args[3], -1); assert.equal(result.args[4], true);
  calls.length = 0; result = api.createSketchProjectionTarget({ kind: 'spline', item: source }, 'spline-target'); assert.deepEqual(calls, ['point', 'point', 'spline']); assert.equal(result.args[0][0], points.at(-2)); assert.equal(result.args[0][1], points.at(-1)); assert.equal(result.args[1], true); assert.equal(result.args[2], true);
  assert.equal(new Set(points.map(p => p.id)).size, points.length); assert.equal(points.every(p => p !== p1 && p !== p2), true); assert.equal(JSON.stringify(source), before);
});
test('legacy target construction preserves unsupported-kind no-allocation and original creation failure propagation', () => {
  const calls = [], error = new Error('radius'), api = sandbox.window.SketchProjectionTestDriver.createLegacyTargetConstruction({
    addPointToSketch: (...args) => { calls.push(args); return {}; }, addLine: () => {}, addCircle: () => { throw Error('must not construct circle'); }, addArc: () => {}, addSpline: () => {},
  });
  assert.equal(api.createSketchProjectionTarget({ kind: 'hatch', item: {} }, 'target'), null); assert.equal(calls.length, 0);
  const source = { center: { x: 2, y: 3 }, radius: () => { throw error; } };
  assert.throws(() => api.createSketchProjectionTarget({ kind: 'circle', item: source }, 'target'), caught => caught === error);
  assert.deepEqual(calls, [[2, 3, 'target', 'endpoint']]);
});
