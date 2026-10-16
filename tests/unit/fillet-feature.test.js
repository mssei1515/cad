const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js',
  'src/editing/geometry_ids.js', 'src/editing/geometry_creation.js', 'src/editing/checkpoint.js', 'src/editing/selection.js',
  'src/editing/pending_command_session.js', 'src/geometry/fillet_geometry.js', 'src/editing/fillet_construction.js',
  'src/commands/fillet_command.js', 'src/application/fillet_feature.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const w = sandbox.window;
function fixture(rejectArc = false) {
  const model = { points: [], lines: [], circles: [], arcs: [], splines: [], annotations: [], constraints: [],
    blockInstances: [], geometryInstances: [], parameters: [], nextDimensionParameterIndex: 1 };
  const events = [], state = { reads: 0, pointer: { x: 3, y: 4 }, stabilized: true }, ids = w.GeometryIds.create();
  const currentScope = () => { state.reads++; return model; };
  const geometry = w.GeometryCreation.create({ currentScope, ids, assignSketchId: item => { item.sketchId = 'S1'; },
    currentConstruction: () => false, minLineLength: 1, minArcLength: 1 });
  const selection = w.CanvasSelection.create(), pending = w.PendingCommandSession.create({});
  const checkpoint = w.EditingCheckpoint.create({ currentScope, ids, invalidateProjection: () => events.push('projection'), invalidateAnalysis: () => events.push('checkpoint-analysis') });
  const command = w.FilletFeature.create({ geometry: rejectArc ? { ...geometry, addArc: () => null } : geometry, minLineLength: 1,
    defaultDimensionForTarget: () => ({ display: {} }), syncLineOrientationHints: () => events.push('orientation'),
    pushModelConstraint: constraint => { constraint.sketchId = 'S1'; model.constraints.push(constraint); },
    pending, selection, readPointer: () => state.pointer, prepareStart: () => events.push('prepare'), clearSnap: () => events.push('snap'),
    updateToolbar: () => events.push('toolbar'), guardSketchProjectionShapeEdit: () => true,
    valueInput: { hide: () => events.push('hide') }, checkpoint, clearSelection: selection.clear,
    stabilize: () => { events.push('stabilize'); return { success: state.stabilized, result: { errorNorm: 0 } }; }, acceptError: 1e-4,
    invalidateAnalysis: () => events.push('invalidate'), refreshConstraintAnalysis: () => events.push('analysis'),
    applicationText: (_ja, en) => en, setHint: () => events.push('hint'), updateUI: options => events.push(['ui', options]),
    updateGeometrySelectionUI: () => events.push('selection-ui'), draw: () => events.push('draw'), recordHistory: () => events.push('history'),
    cancelConstraintTargetCommand: () => events.push('cancel'),
  });
  function corner() {
    const point = geometry.addPoint(0, 0), first = geometry.addLine(point, geometry.addPoint(30, 0)), second = geometry.addLine(geometry.addPoint(0, 30), point);
    selection.set('lines', [first, second]); return { point, first, second };
  }
  return { command, state, model, ids, events, selection, pending, corner };
}

test('Fillet feature stays idle until called, then connects preselected lines and commits an editable radius and tangent arc', () => {
  const f = fixture(); assert.equal(f.state.reads, 0); assert.deepEqual(f.events, []); assert.equal(Object.isFrozen(f.command), true);
  const { point, first, second } = f.corner(); f.command.begin();
  assert.equal(f.events.includes('prepare'), false); assert.equal(f.pending.current.line1, first); assert.equal(f.pending.current.line2, second);
  assert.equal(f.pending.current.preview.radius, 5); assert.equal(first.p1, point); assert.equal(second.p2, point);
  assert.equal(f.command.submit({ x: 3, y: 4 }), true);
  assert.equal(f.pending.current, null); assert.equal(f.model.arcs.length, 1); assert.equal(f.model.points.length, 6); assert.equal(f.model.constraints.length, 7);
  assert.notEqual(first.p1, point); assert.notEqual(second.p2, point); assert.equal(f.model.arcs[0].radius(), 5);
  assert.equal(f.model.constraints.at(-1).dimension.display.prefix, 'R'); assert.equal(f.model.constraints.at(-1).primitive, f.model.arcs[0]);
  assert.equal(f.selection.lines.length, 0); assert.equal(f.events.at(-1), 'history');
  assert.ok(f.events.indexOf('analysis') < f.events.indexOf('history'));
  assert.equal(f.events.find(event => Array.isArray(event))[1].refreshAnalysis, false);
});

test('Fillet stabilization refusal restores endpoint objects, generated data and IDs but preserves the existing cleared selection', () => {
  const f = fixture(), { point, first, second } = f.corner(), ids = JSON.stringify(f.ids.snapshot());
  f.command.begin(); f.state.stabilized = false;
  assert.equal(f.command.submit({ x: 3, y: 4 }), true);
  assert.equal(f.pending.current, null); assert.equal(first.p1, point); assert.equal(second.p2, point);
  assert.equal(f.model.lines[0], first); assert.equal(f.model.lines[1], second);
  assert.equal(f.model.points.length, 3); assert.equal(f.model.arcs.length, 0); assert.equal(f.model.constraints.length, 0);
  assert.equal(JSON.stringify(f.ids.snapshot()), ids); assert.equal(f.selection.lines.length, 0);
  assert.equal(f.events.includes('stabilize'), true); assert.equal(f.events.includes('history'), false);
});

test('Fillet arc insertion refusal uses the same checkpoint and skips stabilization without clearing the original selection', () => {
  const f = fixture(true), { point, first, second } = f.corner(), ids = JSON.stringify(f.ids.snapshot());
  f.command.begin(); assert.equal(f.command.submit({ x: 3, y: 4 }), true);
  assert.equal(f.pending.current, null); assert.equal(first.p1, point); assert.equal(second.p2, point);
  assert.equal(f.model.points.length, 3); assert.equal(f.model.arcs.length, 0); assert.equal(f.model.constraints.length, 0);
  assert.equal(JSON.stringify(f.ids.snapshot()), ids); assert.equal(f.selection.lines[0], first); assert.equal(f.selection.lines[1], second);
  assert.equal(f.events.includes('stabilize'), false); assert.equal(f.events.includes('history'), false);
});
