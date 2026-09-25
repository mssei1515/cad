const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['geometry/geometry_kernel', 'geometry/spline_geometry', 'geometry/offset_chain', 'solver/constraint_solver', 'constraints/dimension_queries', 'editing/geometry_ids', 'editing/geometry_creation', 'geometry/offset_geometry', 'editing/offset_construction', 'commands/offset_command']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', `${file}.js`), 'utf8'), sandbox);
}
const w = sandbox.window;
function fixture() {
  const model = { points: [], lines: [], circles: [], arcs: [], constraints: [], nextDimensionParameterIndex: 7 };
  const ids = w.GeometryIds.create(), events = [];
  const geometry = w.GeometryCreation.create({ currentScope: () => model, ids,
    assignSketchId: item => { item.sketchId = 'S1'; }, currentConstruction: () => false, minLineLength: 0.1, minArcLength: 0.1 });
  const plans = w.OffsetGeometry.create({ types: w.GeometrySolver, kernel: w.GeometryKernel, buildOffsetChainGeometry: w.OffsetChainEngine.build });
  const placement = { dimensionWithLabelAt: (_target, dimension) => dimension, dimensionFromAnchor: (_target, point) => ({ ...point }) };
  let accepted = false, pending = null;
  const construction = w.OffsetConstruction.create({ currentScope: () => model, geometryIds: ids, geometry, plans, placement,
    types: w.GeometrySolver, kernel: w.GeometryKernel, minLineLength: 0.1, minArcLength: 0.1,
    commitNewConstraint: (kind, constraint) => { events.push(kind); if (accepted) model.constraints.push(constraint); return accepted; },
    normalizeAppearance: value => ({ ...value }), offsetPairSign: w.DimensionQueries.offsetPairSign,
    offsetChainErrorText: result => result.code, applicationText: value => value,
    setHint: () => events.push('hint'), updateUI: () => events.push('ui'), draw: () => events.push('draw'), invalidateAnalysis: () => events.push('invalidate') });
  const command = w.OffsetCommand.create({ getPending: () => pending, setPending: value => { pending = value; events.push(value ? 'pending' : 'clear'); },
    plans, construction, placement, offsetSelection: { isClosed: () => false, reset: () => events.push('reset') },
    viewport: { scale: 2 }, Line: w.GeometrySolver.Line, minOrientationLength: w.GeometryKernel.MIN_ORIENTATION_LENGTH,
    offsetPairSign: w.DimensionQueries.offsetPairSign, offsetChainErrorText: result => result.code,
    formatDisplayNumber: String, formatDimensionLabel: String, setHint: () => events.push('hint'), updateToolbar: () => events.push('toolbar'),
    syncDimensionValueInput: () => events.push('sync'), focusDimensionValueInput: () => events.push('focus'), hideDimensionValueInput: () => events.push('hide'),
    draw: () => events.push('draw'), clearPointerPreview: () => events.push('preview'), clearSelection: () => events.push('selection') });
  const line = geometry.addLine(geometry.addPoint(0, 0), geometry.addPoint(100, 0));
  return { model, ids, geometry, plans, construction, command, line, events, get pending() { return pending; }, accept: () => { accepted = true; } };
}
test('offset measurements respect traversal direction and drafts do not allocate document geometry', () => {
  const f = fixture(), before = JSON.stringify(f.model), ids = JSON.stringify(f.ids.snapshot());
  const normal = f.plans.offsetChainDistanceFromPointer([{ geometry: f.line, reversed: false }], { x: 50, y: 10 });
  const reverse = f.plans.offsetChainDistanceFromPointer([{ geometry: f.line, reversed: true }], { x: 50, y: 10 });
  assert.equal(normal.distance, 10); assert.equal(reverse.side, -normal.side);
  const draft = f.plans.offsetDraftGeometry(f.line, 10, 1);
  assert.equal(draft.p1.y, 10); assert.equal(draft.p2.y, 10);
  assert.equal(JSON.stringify(f.model), before); assert.equal(JSON.stringify(f.ids.snapshot()), ids);
});
test('rejected single and chain creation restore geometry allocations and successful chain preserves sources', () => {
  const f = fixture(); const second = f.geometry.addLine(f.line.p2, f.geometry.addPoint(100, 100));
  const before = JSON.stringify(f.model), ids = JSON.stringify(f.ids.snapshot());
  assert.equal(f.construction.createOffsetGeometry(f.line, 10, 1, { x: 50, y: 10 }), false);
  assert.equal(JSON.stringify(f.model), before); assert.equal(JSON.stringify(f.ids.snapshot()), ids);
  const entries = [{ geometry: f.line, reversed: false }, { geometry: second, reversed: false }];
  assert.equal(f.construction.createOffsetChainGeometry(entries, 10, 1, { x: 50, y: 10 }, false), false);
  assert.equal(JSON.stringify(f.model), before); assert.equal(JSON.stringify(f.ids.snapshot()), ids);
  f.accept(); assert.equal(f.construction.createOffsetChainGeometry(entries, 10, 1, { x: 50, y: 10 }, false), true);
  assert.equal(f.model.constraints.length, 1); assert.equal(f.model.constraints[0].sources[0], f.line);
  assert.equal(f.model.lines.length, 4); assert.equal(f.line.p1.y, 0);
});
test('zero-distance input uses screen fallback and invalid values preserve pending state before successful completion', () => {
  const f = fixture(); assert.equal(f.command.start(f.line, { x: 50, y: 0 }), true);
  assert.equal(f.pending.buffer, '10'); assert.equal(f.events.at(-1), 'focus');
  const pending = f.pending; pending.buffer = '0';
  assert.equal(f.command.submit(), false); assert.equal(f.pending, pending); assert.equal(f.model.lines.length, 1);
  pending.buffer = '20'; f.accept(); assert.equal(f.command.submit(), true);
  assert.equal(f.pending, null); assert.equal(f.model.lines.length, 2);
  assert.ok(f.events.indexOf('hide') < f.events.indexOf('offset'));
  assert.deepEqual(f.events.slice(-6), ['reset', 'preview', 'selection', 'toolbar', 'hint', 'draw']);
});
