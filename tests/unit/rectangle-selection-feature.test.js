const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js',
  'src/geometry/bounds.js', 'src/geometry/hatch_region.js', 'src/geometry/reference_image_geometry.js',
  'src/editing/selection.js', 'src/editing/rectangle_selection_query.js', 'src/editing/canvas_selection_interaction.js',
  'src/editing/instance_command_input.js', 'src/commands/selection_rectangle.js', 'src/application/rectangle_selection_feature.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
function fixture() {
  const events = [], state = { active: 'S1', mode: 'select', failure: null,
    model: Object.fromEntries(['points', 'lines', 'circles', 'arcs', 'splines', 'blockInstances', 'geometryInstances',
      'annotations', 'hatches', 'referenceImages', 'constraints'].map(key => [key, []])) };
  const selection = sandbox.window.CanvasSelection.create();
  const selectionScope = sandbox.window.CanvasSelection.createScopeQuery({ canvasSelection: selection, selectedGeometryItems: selection.selectedGeometryItems });
  const viewport = { scale: 1 };
  const geometryReads = Object.fromEntries(['points', 'lines', 'circles', 'arcs', 'splines', 'hatches'].map(key =>
    [key === 'hatches' ? 'allHatches' : 'allGeometry' + key[0].toUpperCase() + key.slice(1), () => state.model[key]]));
  const source = { instance: { type: 'mirror' }, addSources(items) { events.push('source'); state.sources = items; } };
  const api = sandbox.window.RectangleSelectionFeature.create({
    currentScope: () => { events.push('scope'); if (state.failure) throw state.failure; return state.model; },
    viewport, canvasSelection: selection, selectionScope,
    sketches: { activeSketchId: () => state.active, elementSketchId: item => item.sketchId,
      isActiveSketchElement: item => item.sketchId === state.active },
    pointUsage: { isExplicitPoint: point => !point.support, isReferencePoint: point => point.reference },
    appearance: { isVisibleSketchElement: item => item.visible !== false, isVisibleSketchId: () => true, isVisibleValue: value => value !== false },
    geometryReads, projections: {}, hatches: {}, dimensionBounds: { read: () => null }, annotationBounds: () => null,
    hatchAppearanceForDisplay: () => ({ visible: true }), readMode: () => state.mode, instanceSourceCommand: source,
    geometryInstanceCommand: { addSources(items) { events.push('geometry'); state.sources = items; } },
    sketchProjection: { sketchProjectionEntriesByRect: () => { events.push('entries'); return state.entries; },
      command: { addByRect: (rect, crossing) => { events.push('projection'); state.projection = { rect, crossing }; } } },
    releasePointer: id => events.push('release:' + id), clearSelection: () => { events.push('clear'); selection.clear(); },
    setHint: () => events.push('hint'), updateGeometrySelectionUI: () => events.push('ui'), draw: () => events.push('draw'),
  });
  function finish({ kind, additive = false, end = { x: 10, y: 10 } } = {}) {
    api.rectangle.begin({ x: 0, y: 0 }, { kind, additive }); api.rectangle.update(end);
    return api.rectangle.finish({ pointerId: 7 });
  }
  return { api, state, selection, viewport, events, source, finish };
}
test('normal rectangle shares the query result and current scope without constructing or copying selection state', () => {
  const f = fixture(); assert.deepEqual(f.events, []); assert.equal(f.api.rectangle.active, false);
  const point = { x: 5, y: 5, sketchId: 'S1' }, other = { x: 6, y: 6, sketchId: 'S2' };
  f.state.model.points = [point, other]; assert.equal(f.api.query.read({ x1: 0, y1: 0, x2: 10, y2: 10 }, false).points[0], point);
  f.events.length = 0; assert.equal(f.finish(), true); assert.equal(f.selection.points[0], point);
  assert.deepEqual(f.events, ['release:7', 'scope', 'hint', 'ui', 'draw']);
  f.state.active = 'S2'; f.state.model = { ...f.state.model, points: [other] }; f.finish();
  assert.equal(f.selection.points[0], other); assert.equal(point.x, 5);
});
test('additive scope guard and zoom threshold retain selection and finish notification order', () => {
  const f = fixture(), point = { x: 1, y: 1, sketchId: 'S2' }; f.selection.set('points', [point]);
  f.finish({ additive: true }); assert.equal(f.selection.points[0], point);
  assert.deepEqual(f.events, ['release:7', 'hint', 'ui', 'draw']); f.events.length = 0;
  f.finish({ end: { x: 2, y: 0 } }); assert.equal(f.selection.points.length, 0);
  assert.deepEqual(f.events, ['release:7', 'clear', 'ui', 'draw']); f.events.length = 0;
  f.viewport.scale = 2; f.finish({ end: { x: 2, y: 0 } });
  assert.deepEqual(f.events, ['release:7', 'scope', 'hint', 'ui', 'draw']);
});
test('instance, pattern and projection rectangle paths preserve source identity and independent notification rules', () => {
  const f = fixture(), point = { x: 5, y: 5, sketchId: 'S1' }; f.state.model.points = [point];
  f.state.mode = 'instance-sources'; f.finish({ kind: 'instance-sources' }); assert.equal(f.state.sources[0], point);
  assert.deepEqual(f.events, ['release:7', 'source', 'draw']); f.events.length = 0;
  f.state.mode = 'pattern-placement-free'; f.finish({ kind: 'instance-sources' });
  assert.deepEqual(f.events, ['release:7', 'geometry', 'draw']); f.events.length = 0;
  f.state.mode = 'instance-sources'; f.source.instance.type = 'sketchProjection'; f.state.entries = [{ item: point }, { item: point }];
  f.finish({ kind: 'instance-sources' }); assert.equal(f.state.sources[0], point); assert.equal(f.state.sources[1], point);
  assert.deepEqual(f.events, ['release:7', 'entries', 'source', 'draw']); f.events.length = 0;
  f.finish({ kind: 'sketch-projection', end: { x: -10, y: 10 } }); assert.equal(f.state.projection.crossing, true);
  assert.deepEqual(f.events, ['release:7', 'projection']);
});
test('a failing query clears the rectangle session and preserves the original exception boundary', () => {
  const f = fixture(), failure = new Error('query failed'); f.state.failure = failure;
  assert.throws(() => f.finish(), error => error === failure); assert.equal(f.api.rectangle.active, false);
  assert.deepEqual(f.events, ['release:7', 'scope']); assert.equal(f.api.rectangle.finish({ pointerId: 7 }), false);
});
