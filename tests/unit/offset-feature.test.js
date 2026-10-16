const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js',
  'src/document/appearance.js', 'src/geometry/offset_chain.js', 'src/constraints/dimension_queries.js', 'src/ui/number_display.js',
  'src/editing/selection.js', 'src/editing/geometry_ids.js', 'src/editing/geometry_creation.js', 'src/editing/offset_selection.js',
  'src/editing/pending_command_session.js', 'src/geometry/offset_geometry.js', 'src/editing/offset_construction.js',
  'src/commands/offset_command.js', 'src/rendering/offset_preview_renderer.js', 'src/application/offset_feature.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const w = sandbox.window, g = w.GeometrySolver;
const scope = () => ({ points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [], activeSketchId: 'S1' });
function fixture() {
  const state = { scope: scope(), reads: 0, mode: 'select', accepted: true }, events = [], ids = w.GeometryIds.create();
  const currentScope = () => { state.reads++; return state.scope; };
  const selection = w.CanvasSelection.create(), pending = w.PendingCommandSession.create({});
  const preview = { pointer: null, setPointer(point) { assert.equal(this, preview); this.pointer = point; } };
  const geometry = w.GeometryCreation.create({ currentScope, ids, assignSketchId: item => { item.sketchId = state.scope.activeSketchId; },
    currentConstruction: () => false, minLineLength: 0.01, minArcLength: 0.01 });
  const sourceSelection = w.OffsetSelection.create({ ...g, getModel: currentScope, activeSketchId: () => state.scope.activeSketchId,
    elementSketchId: item => item.sketchId, constraintSketchId: item => item.sketchId,
    onSelectionChanged: () => selection.applyOffsetSelection(sourceSelection) });
  const viewport = { scale: 2 }, ctx = {};
  for (const name of ['beginPath', 'moveTo', 'lineTo', 'arc', 'stroke', 'setLineDash']) ctx[name] = (...args) => events.push([name, ...args]);
  const feature = w.OffsetFeature.create({ currentScope, geometry, ids, placement: {
    dimensionWithLabelAt: (target, dimension, pointer) => ({ ...dimension, x: pointer.x, y: pointer.y }), dimensionFromAnchor: () => ({ anchor: true }),
  }, sourceSelection, selection, pending, preview, valueInput: { sync: () => events.push(['sync']), focus: () => events.push(['focus']), hide: () => events.push(['hide']) },
  viewport, ctx, withCanvasState: work => work(), drawDimension: (...args) => events.push(['dimension', ...args]), readMode: () => state.mode,
  minLineLength: 0.01, minArcLength: 0.01, commitNewConstraint: (type, constraint) => {
    events.push(['commit', type, constraint]); if (state.accepted) state.scope.constraints.push(constraint); return state.accepted;
  }, offsetChainErrorText: plan => plan.code, applicationText: (_ja, en) => en,
  cancelConstraintTargetCommand: () => events.push(['cancel-constraint']), cancelPendingCommand: () => events.push(['cancel-pending']),
  clearSnap: () => events.push(['clear-snap']), clearSelection: selection.clear, prepareStart: () => events.push(['prepare']),
  setHint: (...args) => events.push(['hint', ...args]), updateUI: () => events.push(['ui']), draw: () => events.push(['draw']),
  updateToolbar: () => events.push(['toolbar']), updateGeometrySelectionUI: () => events.push(['selection-ui']), invalidateAnalysis: () => events.push(['invalidate']),
  });
  const line = () => geometry.addLine(geometry.addPoint(0, 0, false, 'endpoint'), geometry.addPoint(20, 0, false, 'endpoint'));
  return { feature, state, events, ids, geometry, sourceSelection, selection, pending, preview, line, viewport };
}

test('Offset composition creates no eager model work and preserves planning defaults and externally owned selection', () => {
  const f = fixture(); assert.equal(f.state.reads, 0); assert.deepEqual(f.events, []); assert.equal(Object.isFrozen(f.feature), true);
  const first = f.line(); f.sourceSelection.add(first);
  assert.equal(f.selection.lines[0], first); assert.equal(f.sourceSelection.source, first);
  const entries = f.sourceSelection.entries;
  const plan = f.feature.chainDraft(entries, 2, 1);
  assert.equal(plan.ok, true); assert.equal(plan.geometries.length, 1);
  assert.equal(plan.geometries[0].p1.y, 2); assert.equal(plan.geometries[0].p2.y, 2);
  assert.equal(f.sourceSelection.entries[0].geometry, first); assert.equal(first.p1.y, 0); assert.equal(first.p2.y, 0);
});

test('Offset feature connects source selection, distance input and successful geometry commit through the same owners', () => {
  const f = fixture(), source = f.line();
  f.feature.command.click({ x: 10, y: 0 }, { hitL: source });
  assert.equal(f.selection.lines[0], source); assert.equal(f.sourceSelection.entries[0].geometry, source);
  f.feature.command.click({ x: 10, y: 4 }, {});
  assert.equal(f.pending.current.type, 'offset-value'); assert.equal(f.pending.current.source, source); assert.equal(f.pending.current.buffer, '4');
  f.pending.current.buffer = '5'; assert.equal(f.feature.command.submit(), true);
  assert.equal(f.state.scope.lines.length, 2); assert.equal(f.state.scope.points.length, 4);
  const offset = f.state.scope.lines[1]; assert.equal(offset.p1.y, 5); assert.equal(offset.p2.y, 5);
  assert.equal(f.state.scope.constraints[0].target, 5);
  assert.equal(f.pending.current, null); assert.equal(f.preview.pointer, null); assert.equal(f.sourceSelection.source, null); assert.equal(f.selection.lines.length, 0);
  assert.ok(f.events.findIndex(event => event[0] === 'hide') < f.events.findIndex(event => event[0] === 'commit'));
});

test('Offset construction reads the replacement scope and restores allocation and arrays when commit refuses', () => {
  const f = fixture(), previous = f.state.scope; f.state.scope = scope(); f.state.scope.activeSketchId = 'S2';
  const source = f.line(), pointSeq = f.ids.peek('point'), lineSeq = f.ids.peek('line'), points = f.state.scope.points;
  f.state.accepted = false;
  assert.equal(f.feature.createGeometry(source, 3, 1, { x: 10, y: 3 }), false);
  assert.equal(previous.lines.length, 0); assert.equal(previous.points.length, 0);
  assert.equal(f.state.scope.points, points); assert.equal(points.length, 2); assert.equal(f.state.scope.lines.length, 1); assert.equal(f.state.scope.lines[0], source);
  assert.equal(source.sketchId, 'S2'); assert.equal(f.ids.peek('point'), pointSeq); assert.equal(f.ids.peek('line'), lineSeq);
  assert.equal(f.events.filter(event => event[0] === 'invalidate').length, 1);
});

test('Offset preview follows the current mode and pointer and uses the same externally selected circle', () => {
  const f = fixture(), circle = f.geometry.addCircle(f.geometry.addPoint(0, 0, false, 'center'), 10);
  f.selection.set('circles', [circle]); f.feature.command.begin();
  assert.equal(f.sourceSelection.source, circle);
  f.preview.setPointer({ x: 20, y: 0 }); f.events.length = 0;
  f.feature.previewLayer.draw(); assert.deepEqual(f.events, []);
  f.state.mode = 'offset'; f.feature.previewLayer.draw();
  assert.equal(f.events.find(event => event[0] === 'arc')[3], 20);
  const dimension = f.events.find(event => event[0] === 'dimension'); assert.equal(dimension[3], '10'); assert.equal(dimension[4], true);
  f.sourceSelection.reset(); f.events.length = 0; f.feature.previewLayer.draw(); assert.deepEqual(f.events, []);
});
