const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
test('staged constraint assembly keeps child construction order and uses shared owners instead of legacy callbacks', () => {
  const order = [], originals = new Map();
  for (const name of ['AnnotationCommandInput', 'InstanceCommandInput', 'PointCommand', 'DrawingCommandInput', 'CanvasSelectionInteraction']) {
    const owner = w[name]; originals.set(name, owner);
    w[name] = { ...owner, create(...args) { order.push(name); return owner.create(...args); } };
  }
  try {
    let built, pending = { type: 'distance-place' }; const calls = [], pointer = {};
    const feature = w.ConstraintCommandInput.createFeature({
      pending: { read: () => pending, get current() { return pending; } }, targets: { command: null },
      canvasHover: { update() { throw new Error('unexpected continuation'); } }, canvasPoint: () => pointer,
      placement: { retargetDistancePlaceWithOperand(p) { calls.push(['retarget', p]); return false; }, startDistanceValueInput(p) { calls.push(['value', p]); } },
      constraints: { operandClick() { throw new Error('unexpected operand'); } },
    });
    const dragging = { selectedLineGroup: () => null, command: { begin() {} } };
    const f = fixture({ constraintInputFeature: { createInput(options) {
      order.push('ConstraintCommandInput'); assert.equal(options.dragging, dragging);
      built = feature.createInput(options); return built;
    } }, dimensionDragging: dragging,
      retargetDistancePlaceWithOperand() { throw new Error('legacy retarget'); }, startDistanceValueInput() { throw new Error('legacy value'); } });
    assert.deepEqual(order, ['AnnotationCommandInput', 'ConstraintCommandInput', 'InstanceCommandInput', 'PointCommand', 'DrawingCommandInput', 'CanvasSelectionInteraction']);
    assert.equal(f.api.constraint, built); assert.deepEqual(calls, []);
    assert.equal(f.api.constraint.click(f.event, pointer, {}), true); assert.deepEqual(calls, [['retarget', pointer], ['value', pointer]]);
    pending = null; calls.length = 0; assert.equal(f.api.constraint.click(f.event, pointer, {}), false); assert.deepEqual(calls, []);
  } finally { for (const [name, owner] of originals) w[name] = owner; }
});
function fixture(extra = {}) {
  const calls = [], state = { ready: false, mode: 'select', pending: null, constraint: null, focus: true, reject: false, group: null, top: null, points: [], rollbackError: null };
  const ready = () => assert.equal(state.ready, true);
  const record = name => (...args) => { ready(); calls.push([name, ...args]); };
  const selection = w.CanvasSelection.create(), hover = w.CanvasHover.create({ isEndpointPoint: () => false });
  const point = { id: 'P1', x: 12, y: 15, kind: 'explicit' }, ref = { kind: 'point', path: ['P1'] }, snap = { data: { point } }, snapped = { x: 12, y: 15 };
  const drawingSnap = { active: snap, resolve(p, tolerance, allow) { ready(); calls.push(['resolve', p, tolerance, allow(snap)]); return snapped; } };
  const command = { activeInput: 'origin', pending: { sources: [ref] }, placeFree: record('place'), selectReference: record('reference'), toggleSource: record('source') };
  const focus = { closest(selector) { ready(); assert.equal(this, focus); assert.equal(selector, '#commandPanel'); return state.focus; }, blur() { assert.equal(this, focus); calls.push(['blur']); } };
  const viewport = { scale: 2 };
  const api = w.CanvasCommandInputs.create({
    readMode: () => { ready(); return state.mode; }, readPending: () => { ready(); return state.pending; }, readPendingConstraint: () => { ready(); return state.constraint; },
    document: { get activeElement() { ready(); return focus; } }, canvas: { setPointerCapture(id) { ready(); calls.push(['capture', id]); } },
    canvasSelection: selection, clearSelection: () => { ready(); calls.push(['clear']); selection.clear(); }, canvasHover: hover,
    draw: record('draw'), updateUI: record('ui'), updateGeometrySelectionUI: record('selection-ui'), setHint: record('hint'), applicationText: (_ja, en) => en,
    annotationCommand: { commitTextAnnotationAt: record('text') }, annotationDrag: { begin: record('annotation-drag') }, startAnnotationAnchorConstraint: () => false,
    selectedDimensionLineGroup: constraint => { ready(); calls.push(['group', constraint]); return state.group; }, isDimensionConstraintCommandActive: () => false,
    beginDimensionDrag: record('dimension-drag'), retargetDistancePlaceWithOperand: () => false, startDistanceValueInput: record('dimension-value'),
    instanceSourceCommand: { instance: { type: 'pattern' }, toggle: record('toggle-source') }, geometryInstanceCommand: command,
    hitReferenceTarget: () => null, hitDerivedProjectionOperand: () => null, hitBlockProjectionOperand: () => null, operandElement: value => value,
    clearSnap: () => { ready(); calls.push(['clear-snap']); drawingSnap.active = null; }, selectionRectangle: { begin: record('rectangle') },
    hitHatchAt: (x, y, options) => { ready(); calls.push(['hatch', x, y, options.activeOnly]); return null; }, drawingSnap, viewport,
    geometryRefForItem: item => { assert.equal(item, point); return ref; }, resolveGeometryRef: () => point,
    snapForDrawing: p => { ready(); calls.push(['snap', p]); return snapped; },
    transientAuthoring: { clearTransientPointRollback: record('rollback-clear'), beginTransientPointRollback: () => { ready(); calls.push(['rollback-begin']); if (state.rollbackError) throw state.rollbackError; }, markCreatedPoint: record('created') },
    addPoint: (x, y, fixed) => { ready(); const value = { x, y, fixed }; state.points.push(value); calls.push(['point', value]); return value; },
    addPointSnapConstraints: record('snap-constraint'), solveAndRefresh: record('solve'), rejectRootSketchCreation: () => { ready(); return state.reject; },
    sameArcEndpoint: (a,b) => a === b, topmostDrawingOrderOwner: () => state.top, drawingOrderOwner: item => item,
    geometryDrag: { begin: () => false }, ...extra,
  });
  assert.deepEqual(calls, []); state.ready = true;
  const event = { pointerId: 7, preventDefault: record('prevent') }, p = { x: 8, y: 10 };
  return { api, state, calls, selection, hover, command, drawingSnap, viewport, event, p, snap, snapped, names: () => calls.map(call => call[0]) };
}

test('input assembly defers all scene and DOM reads and uses the original point lifecycle with shared snap and selection', () => {
  const f = fixture(); assert.ok(Object.isFrozen(f.api)); assert.deepEqual(Object.keys(f.api), ['instance','annotation','constraint','drawing','selection']);
  f.state.mode = 'point'; f.state.reject = true; assert.equal(f.api.drawing.click(f.event, f.p, {}), true);
  assert.deepEqual(f.names(), ['prevent']); assert.equal(f.state.points.length, 0);
  f.calls.length = 0; f.state.reject = false; assert.equal(f.api.drawing.click(f.event, f.p, {}), true);
  assert.deepEqual(f.names(), ['rollback-clear','rollback-begin','snap','point','created','snap-constraint','clear-snap','solve']);
  assert.equal(f.selection.points[0], f.state.points[0]); assert.equal(f.calls[5][1], f.selection.points[0]); assert.equal(f.calls[5][2], f.snap);
  assert.deepEqual(f.calls.at(-1), ['solve','点追加']);
  f.calls.length = 0; const error = new Error('rollback failed'); f.state.rollbackError = error;
  assert.throws(() => f.api.drawing.click(f.event, f.p, {}), value => value === error);
  assert.deepEqual(f.names(), ['rollback-clear','rollback-begin']); assert.equal(f.state.points.length, 1);
});

test('annotation and instance inputs share lazy focus release and preserve source rectangle and capture order', () => {
  const f = fixture(); f.state.pending = { type: 'annotation-text-place', annotationDraft: {} };
  assert.equal(f.api.annotation.place(f.event, f.p, null), true); assert.deepEqual(f.names(), ['blur','prevent','text']); assert.equal(f.calls.at(-1)[1], f.p);
  f.calls.length = 0; f.state.pending = null; f.state.mode = 'instance-sources';
  assert.equal(f.api.instance.click(f.event, f.p, {}), true);
  assert.deepEqual(f.names(), ['blur','prevent','hatch','clear-snap','rectangle','capture']); assert.deepEqual(f.calls[2], ['hatch',8,10,false]);
  assert.equal(f.calls[4][1], f.p); assert.equal(f.calls[4][2].kind, 'instance-sources'); assert.equal(f.calls[5][1], 7);
  f.calls.length = 0; f.state.focus = false; f.api.instance.click(f.event, f.p, { hitL: {} }); assert.deepEqual(f.names(), ['prevent','toggle-source']);
});

test('pattern origin snap uses current command sources and viewport tolerance while other inputs retain ordinary snap', () => {
  const f = fixture(); f.state.mode = 'pattern-placement-linear';
  assert.equal(f.api.instance.click(f.event, f.p, {}), true);
  assert.deepEqual(f.names(), ['blur','resolve','place']); assert.equal(f.calls[1][2], 5); assert.equal(f.calls[1][3], true);
  assert.equal(f.calls[2][1], f.snapped); assert.equal(f.calls[2][2], f.snap);
  f.calls.length = 0; f.viewport.scale = 4; f.command.pending = { sources: [] }; f.api.instance.click(f.event, f.p, {});
  assert.equal(f.calls[1][2], 2.5); assert.equal(f.calls[1][3], false);
  f.calls.length = 0; f.command.activeInput = 'reference'; const line = {}; f.api.instance.click(f.event, f.p, { hitL: line });
  assert.deepEqual(f.names(), ['blur','snap','reference']); assert.equal(f.calls.at(-1)[1], line);
});

test('shared primitive input routes original arguments without rebinding or invoking legacy callbacks', () => {
  const calls = [], names = ['line', 'rectangle', 'slot', 'circle', 'arc', 'threePointArc'];
  const basicDrawingInput = Object.fromEntries(names.map(name => [name, function(point, shift) {
    'use strict'; assert.equal(this, undefined); calls.push({ name, args: Array.from(arguments) }); return false;
  }]));
  const legacy = Object.fromEntries(['handleLineClick', 'handleRectangleClick', 'handleSlotClick', 'handleCircleClick', 'handleArcClick', 'handleThreePointArcClick'].map(name => [name, () => { throw Error('legacy callback used'); }]));
  const f = fixture({ basicDrawingInput, ...legacy }); assert.deepEqual(calls, []); f.event.shiftKey = true;
  for (const [mode, name] of [['line', 'line'], ['rectangle', 'rectangle'], ['slot', 'slot'], ['circle', 'circle'], ['arc', 'arc'], ['three-point-arc', 'threePointArc']]) {
    f.state.mode = mode; assert.equal(f.api.drawing.click(f.event, f.p, {}), true);
    assert.deepEqual(calls.at(-1), { name, args: name === 'line' ? [f.p, true] : [f.p] });
  }
  basicDrawingInput.line = () => { throw Error('router must retain its originally supplied callback'); };
  f.state.mode = 'line'; assert.equal(f.api.drawing.click(f.event, f.p, {}), true); assert.equal(calls.at(-1).name, 'line');
  const count = calls.length; f.state.reject = true; assert.equal(f.api.drawing.click(f.event, f.p, {}), true); assert.equal(calls.length, count);
  f.state.mode = 'select'; assert.equal(f.api.drawing.click(f.event, f.p, {}), false); assert.equal(calls.length, count);
});

test('legacy primitive ports still route every mode and shared input errors keep their original identity', () => {
  const calls = [], ports = {};
  for (const name of ['Line', 'Rectangle', 'Slot', 'Circle', 'Arc', 'ThreePointArc']) ports[`handle${name}Click`] = (...args) => calls.push({ name, args });
  const f = fixture(ports); f.event.shiftKey = false;
  for (const [mode, name] of [['line', 'Line'], ['rectangle', 'Rectangle'], ['slot', 'Slot'], ['circle', 'Circle'], ['arc', 'Arc'], ['three-point-arc', 'ThreePointArc']]) {
    f.state.mode = mode; assert.equal(f.api.drawing.click(f.event, f.p, {}), true);
    assert.deepEqual(calls.at(-1), { name, args: name === 'Line' ? [f.p, false] : [f.p] });
  }
  const error = new Error('primitive failed'), shared = fixture({ basicDrawingInput: { line: () => { throw error; } } });
  shared.state.mode = 'line'; assert.throws(() => shared.api.drawing.click(shared.event, shared.p, {}), value => value === error);
  assert.equal(shared.state.points.length, 0); assert.deepEqual(shared.calls, []);
});

function sharedQueries() {
  const calls = [], state = { ready: false, derived: null, block: null, reference: null, hatch: null, error: null };
  const read = (name, ...args) => { assert.equal(state.ready, true); calls.push([name, ...args]); if (state.error && (!state.errorAt || state.errorAt === name)) throw state.error; };
  const operands = Object.fromEntries(['derived', 'block', 'reference'].map(name => [
    { derived: 'hitDerivedProjectionOperand', block: 'hitBlockProjectionOperand', reference: 'hitReferenceTarget' }[name],
    function(x, y) { 'use strict'; assert.equal(this, undefined); read(name, x, y); return state[name]; },
  ]));
  const regions = { hitHatchAt(x, y, options) { assert.equal(this, regions); read('hatch', x, y, options); return state.hatch; } };
  const source = { instance: { type: 'pattern' }, toggle: item => calls.push(['toggle', item]) }, sceneQueries = { operands, regions };
  const legacy = Object.fromEntries(['hitReferenceTarget', 'hitDerivedProjectionOperand', 'hitBlockProjectionOperand', 'hitHatchAt'].map(name => [name, () => { throw Error('legacy query used'); }]));
  const f = fixture({ sceneQueries, instanceSourceCommand: source, ...legacy,
    operandElement: operand => { read('element', operand); return operand.item; }, toggleSketchProjectionSource: target => calls.push(['projection', target]) });
  assert.deepEqual(calls, []); state.ready = true; f.state.mode = 'instance-sources';
  return { ...f, queries: { calls, state, regions, sceneQueries, source }, queryNames: () => calls.map(call => call[0]) };
}

test('shared scene input preserves projected operand priority, source identity and live reference modes', () => {
  const f = sharedQueries(), { state, calls, source } = f.queries, first = { id: 'same' }, second = { id: 'same' };
  state.derived = { item: first }; state.block = { item: second };
  assert.equal(f.api.instance.click(f.event, f.p, {}), true); assert.deepEqual(f.queryNames(), ['derived', 'element', 'toggle']); assert.equal(calls.at(-1)[1], first);
  calls.length = 0; state.derived = null; f.api.instance.click(f.event, f.p, {});
  assert.deepEqual(f.queryNames(), ['derived', 'block', 'element', 'toggle']); assert.equal(calls.at(-1)[1], second);
  calls.length = 0; const target = { item: first }; state.reference = target; source.instance.type = 'sketchProjection';
  f.api.instance.click(f.event, f.p, {}); assert.deepEqual(f.queryNames(), ['reference', 'element', 'toggle']); assert.equal(calls.at(-1)[1], first);
  calls.length = 0; f.state.mode = 'sketch-projection'; f.api.instance.click(f.event, f.p, {});
  assert.deepEqual(f.queryNames(), ['reference', 'projection']); assert.equal(calls.at(-1)[1], target);
  calls.length = 0; f.state.mode = 'pattern-placement-linear'; f.command.activeInput = 'sources';
  f.api.instance.click(f.event, f.p, {}); assert.deepEqual(f.queryNames(), ['derived', 'block', 'element']); assert.equal(f.calls.at(-1)[1], second);
});

test('shared Hatch input retains its owner, per-call inactive option and exceptions without copying selection or geometry', () => {
  const f = sharedQueries(), { state, calls, sceneQueries } = f.queries;
  state.hatch = { id: 'H' }; f.api.instance.click(f.event, f.p, {});
  assert.deepEqual(f.queryNames(), ['derived', 'block', 'hatch', 'toggle']); assert.equal(calls[2][1], f.p.x); assert.equal(calls[2][2], f.p.y); assert.equal(calls[2][3].activeOnly, false); assert.equal(calls[3][1], state.hatch);
  sceneQueries.regions = { hitHatchAt() { throw Error('original region owner must be retained'); } };
  const next = { id: 'H' }; state.hatch = next; calls.length = 0;
  f.api.instance.click(f.event, { x: 21, y: 34 }, {}); assert.equal(calls[2][1], 21); assert.equal(calls[2][2], 34); assert.equal(calls.at(-1)[1], next);
  calls.length = 0; state.error = new Error('hit failed'); state.errorAt = 'hatch';
  assert.throws(() => f.api.instance.click(f.event, f.p, {}), error => error === state.error);
  assert.equal(calls.at(-1)[0], 'hatch'); assert.equal(f.state.points.length, 0); assert.equal(f.selection.points.length, 0);
});

test('constraint and selection adapters keep shared selection identity, group drag refusal and live pending input', () => {
  const f = fixture(), line = {}, constraint = {}, hit = { constraint }; f.selection.set('lines', [line]); f.state.group = {};
  assert.equal(f.api.constraint.click(f.event, f.p, { hitD: hit }), true);
  assert.deepEqual(f.names(), ['prevent','group','dimension-drag']); assert.equal(f.selection.lines[0], line); assert.equal(f.calls[2][1], f.event); assert.equal(f.calls[2][2], hit);
  f.calls.length = 0; f.state.group = null; f.api.constraint.click(f.event, f.p, { hitD: hit }); assert.equal(f.selection.lines.length, 0);
  f.calls.length = 0; f.state.pending = { type: 'distance-place' }; assert.equal(f.api.constraint.click(f.event, f.p, {}), true); assert.deepEqual(f.names(), ['prevent','dimension-value']);
  f.calls.length = 0; f.state.pending = null; f.state.top = line; f.api.selection.begin({ ...f.event, ctrlKey: true }, f.p, { hitL: line });
  assert.equal(f.selection.lines[0], line); f.api.selection.begin({ ...f.event, shiftKey: true }, f.p, { hitL: line }); assert.equal(f.selection.lines.length, 0);
});
