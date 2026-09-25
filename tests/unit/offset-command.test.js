const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['geometry/geometry_kernel', 'geometry/spline_geometry', 'geometry/offset_chain', 'solver/constraint_solver', 'constraints/dimension_queries', 'editing/geometry_ids', 'editing/geometry_creation', 'geometry/offset_geometry', 'editing/offset_construction', 'commands/offset_command', 'editing/offset_selection', 'rendering/offset_preview_renderer']) {
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
  const selection = w.OffsetSelection.create({ ...w.GeometrySolver, getModel: () => model,
    activeSketchId: () => 'S1', elementSketchId: item => item.sketchId || 'S1', constraintSketchId: item => item.sketchId || 'S1',
    onSelectionChanged: () => events.push('selection-sync') });
  const command = w.OffsetCommand.create({ getPending: () => pending, setPending: value => { pending = value; events.push(value ? 'pending' : 'clear'); },
    plans, construction, placement, offsetSelection: selection,
    viewport: { scale: 2 }, Line: w.GeometrySolver.Line, Circle: w.GeometrySolver.Circle, minOrientationLength: w.GeometryKernel.MIN_ORIENTATION_LENGTH,
    offsetPairSign: w.DimensionQueries.offsetPairSign, offsetChainErrorText: result => result.code,
    formatDisplayNumber: String, formatDimensionLabel: String, setHint: () => events.push('hint'), updateToolbar: () => events.push('toolbar'),
    syncDimensionValueInput: () => events.push('sync'), focusDimensionValueInput: () => events.push('focus'), hideDimensionValueInput: () => events.push('hide'),
    draw: () => events.push('draw'), clearPointerPreview: () => events.push('preview'), clearSelection: () => events.push('selection'),
    setPointerPreview: () => events.push('pointer'), syncOffsetChainSelection: () => events.push('selection-sync'),
    applicationText: value => value, updateGeometrySelectionUI: () => events.push('selection-ui') });
  const line = geometry.addLine(geometry.addPoint(0, 0), geometry.addPoint(100, 0));
  return { model, ids, geometry, plans, construction, command, selection, line, events, get pending() { return pending; }, accept: () => { accepted = true; } };
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
  assert.equal(f.selection.source, null); assert.equal(f.selection.entries.length, 0);
  assert.deepEqual(f.events.slice(-5), ['preview', 'selection', 'toolbar', 'hint', 'draw']);
});

test('click selection distinguishes blank-click input from Enter confirmation and rejects duplicate or circle additions', () => {
  const f = fixture(), pointer = { x: 50, y: 10 };
  assert.equal(f.command.canConfirmSelection(), false);
  f.command.click(pointer, { hitL: f.line });
  assert.equal(f.selection.entries.length, 1); assert.equal(f.pending, null);
  const circle = f.geometry.addCircle(f.geometry.addPoint(0, 0), 30);
  f.command.click(pointer, { hitC: circle });
  f.command.click(pointer, { hitL: f.line });
  assert.equal(f.selection.entries.length, 1); assert.equal(f.selection.source, f.line);
  assert.equal(f.command.canConfirmSelection(), true);
  f.command.confirmSelection(pointer);
  assert.equal(f.selection.committed, true); assert.equal(f.pending, null);
  assert.equal(f.command.canConfirmSelection(), false);
  f.command.click(pointer, {}); assert.equal(f.pending.type, 'offset-value');
  const other = fixture(); other.command.click(pointer, { hitL: other.line });
  other.command.click(pointer, {});
  assert.equal(other.selection.committed, true); assert.equal(other.pending.type, 'offset-value');
});
test('preview updates the input target while the renderer consumes only a plan and restores canvas state before dimensions', () => {
  const f = fixture(), pointer = { x: 50, y: 10 };
  f.command.click(pointer, { hitL: f.line }); f.command.click(pointer, {});
  f.pending.buffer = '20';
  const before = JSON.stringify(f.model), plan = f.command.preview(null);
  assert.equal(plan.distance, 20); assert.equal(plan.geometries[0].p1.y, 20);
  assert.equal(f.pending.target, plan.target); assert.equal(f.pending.dimension, plan.dimension);
  assert.equal(JSON.stringify(f.model), before);
  const calls = [], ctx = { setLineDash: values => calls.push(['dash', ...values]), beginPath() {},
    moveTo() {}, lineTo() {}, stroke: () => calls.push('stroke') };
  const renderer = w.OffsetPreviewRenderer.create({ ctx, viewport: { scale: 2 }, ...w.GeometrySolver,
    withCanvasState: callback => { calls.push('save'); callback(); calls.push('restore'); },
    drawDimension: (target, dimension, label) => { assert.equal(target, plan.target); assert.equal(dimension, plan.dimension); calls.push(label); }, formatDimensionLabel: String });
  renderer.draw(plan);
  assert.equal(ctx.lineWidth, 1); assert.deepEqual(calls, ['save', ['dash', 3, 2.5], 'stroke', 'restore', '20']);
  renderer.draw(null); assert.equal(calls.length, 5);
  assert.equal(JSON.stringify(f.model), before);
});
