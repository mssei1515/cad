const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync('src/commands/dimension_drag.js', 'utf8'), sandbox);
function fixture(kind = 'distance', part = 'line') {
  const state = { commandActive: false, angleResult: {} }, events = [], constraint = {};
  const hit = { constraint, target: { kind }, part, dimension: { labelOffsetU: 7, display: { text: 'kept' } } };
  const command = sandbox.window.DimensionDrag.create({ dimensionAnchor: () => ({ x: 10, y: 20 }), migrateAngleDimensionLabelPlacement: () => {},
    canvasSelection: { set: (key, value) => events.push(['selection', key, value]) }, angleDimensionLabelOffsets: () => ({ radial: 4, tangent: 5 }), viewScale: () => 2,
    isDimensionConstraintCommandActive: () => state.commandActive, beginPointer: id => events.push(['begin', id]), endPointer: id => events.push(['end', id]),
    setHint: text => events.push(['hint', text]), clearSnap: () => events.push('snap'), hypot2: Math.hypot,
    angleDimensionFromLabelPoint: () => state.angleResult, dimensionWithLabelAt: (_target, dimension, p) => ({ ...dimension, labelX: p.x, labelY: p.y }),
    dimensionFromAnchor: (_target, anchor, options) => { assert.equal(options.allowPointAxis, false); return { x: anchor.x, y: anchor.y }; },
    setAngleDimensionLabelOffsets: (dimension, offsets) => Object.assign(dimension, offsets),
    syncAngleConstraintFromDimension: () => events.push('sync'), draw: () => events.push('draw'), continueCommandClick: (_event, hits) => events.push(['click', hits]),
    updateUI: () => events.push('ui'), updateGeometrySelectionUI: () => events.push('selectionUI'), syncDimensionValueInput: () => events.push('input'), recordHistory: label => events.push(['history', label]) });
  const begin = (hits = null) => command.begin({ pointerId: 3 }, hit, { x: 1, y: 2 }, hits);
  return { state, events, constraint, hit, command, begin };
}
test('dimension command click threshold returns to operand input without modifying layout or history', () => {
  const f = fixture(); f.state.commandActive = true; const hits = { hitP: {} }; f.begin(hits);
  f.command.update({ x: 2.5, y: 2 }); assert.equal(f.constraint.dimension, undefined);
  f.command.finish({ pointerId: 3 }); assert.equal(f.command.active, false); assert.equal(f.events.at(-1)[1], hits);
  assert.equal(f.events.some(e => e[0] === 'history'), false);
});
test('dimension line drag keeps display and label offsets and commits through layout notifications', () => {
  const f = fixture(); f.state.commandActive = true; f.begin(); f.command.update({ x: 4, y: 6 });
  assert.deepEqual([f.constraint.dimension.x, f.constraint.dimension.y, f.constraint.dimension.labelOffsetU], [13, 24, 7]);
  assert.equal(f.constraint.dimension.display.text, 'kept'); assert.notEqual(f.constraint.dimension.display, f.hit.dimension.display);
  f.events.length = 0; assert.equal(f.command.finish({ pointerId: 3 }), true);
  assert.deepEqual(f.events.map(e => Array.isArray(e) ? e[0] : e), ['end', 'hint', 'selectionUI', 'input', 'draw', 'history']);
});
test('radius labels anchor at the pointer and angle labels tolerate unresolved placement', () => {
  const radius = fixture('radius', 'label'); radius.begin(); radius.command.update({ x: 4, y: 6 });
  assert.deepEqual([radius.constraint.dimension.x, radius.constraint.dimension.y, radius.constraint.dimension.labelX], [4, 6, 4]);
  const angle = fixture('angle', 'label'); angle.begin(); angle.state.angleResult = null; angle.command.update({ x: 4, y: 6 }); assert.equal(angle.constraint.dimension, undefined);
  angle.state.angleResult = { radial: 9 }; angle.command.update({ x: 4, y: 6 }); assert.equal(angle.constraint.dimension.display.text, 'kept');
  angle.events.length = 0; angle.command.finish({ pointerId: 3 }); assert.equal(angle.events.includes('ui'), true); assert.equal(angle.events.includes('input'), false);
});
test('angle line offsets survive dragging and reset discards the session without committing', () => {
  const f = fixture('angle'); f.begin(); f.command.update({ x: 4, y: 6 });
  assert.deepEqual([f.constraint.dimension.radial, f.constraint.dimension.tangent], [4, 5]); assert.equal(f.command.constraint, f.constraint);
  f.command.reset(); assert.equal(f.command.active, false); assert.equal(f.command.constraint, undefined); assert.equal(f.command.finish({ pointerId: 3 }), false);
  assert.equal(f.events.some(e => e[0] === 'history'), false);
});
