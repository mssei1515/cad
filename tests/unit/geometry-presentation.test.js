const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/rendering/geometry_presentation.js'), 'utf8'), sandbox);
class Point {}
function fixture() {
  const selection = { points: [], lines: [], circles: [], arcs: [], splines: [], blockInstances: [], geometryInstances: [] };
  const hover = { current: {} }, view = { geometryIds: false, constraintStatus: false };
  const presentation = sandbox.window.GeometryPresentation.create({ Point, canvasSelection: selection, canvasHover: hover, viewState: view,
    effectiveAppearanceForElement: item => item.appearance || { color: 'normal', lineWidth: 1.5 },
    isEditableSketchElement: item => !item.inactive, isConstraintOperandSelected: item => !!item.operand,
    isPendingReferenceTarget: item => !!item.reference, isSidebarHighlightedElement: item => !!item.tree,
    isSidebarHoveredElement: item => !!item.sidebar, isReferenceHoverElement: item => !!item.referenceHover,
    isSelectedConstraintRelatedElement: item => !!item.related, sketchAlpha: () => 0.5, sketchStrokeWidth: () => 2,
    constraintStatusColor: () => 'constraint', canvasThemeColor: value => `theme:${value}`, constructionAlpha: 0.72 });
  return { presentation, selection, hover, view };
}
test('instance ownership distinguishes whole instances, internal geometry and point projections', () => {
  const f = fixture(), instance = { id: 'FI1' }, line = { id: 'L1', derivedInstance: instance };
  const point = Object.assign(new Point(), { derivedInstance: instance });
  f.selection.geometryInstances.push(instance); f.hover.current.geometryInstance = instance;
  assert.equal(f.presentation.ownerInstanceSelected(line), true);
  assert.equal(f.presentation.ownerInstanceSelected(point), false);
  point.sourceRef = {}; assert.equal(f.presentation.ownerInstanceSelected(point), true);
  f.selection.instanceGeometry = { instanceId: 'FI1', id: 'L2' };
  assert.equal(f.presentation.ownerInstanceSelected(line), false);
  assert.equal(f.presentation.ownerInstanceHovered(line), false);
  f.selection.instanceGeometry.id = 'L1'; assert.equal(f.presentation.ownerInstanceSelected(line), true);
  const block = {}; f.selection.blockInstances.push(block); f.hover.current.block = block;
  assert.equal(f.presentation.ownerInstanceSelected({ blockInstance: block }), true);
  assert.equal(f.presentation.ownerInstanceHovered({ blockInstance: block }), true);
  assert.equal(f.presentation.ownerInstanceSelected(Object.assign(new Point(), { blockInstance: block })), false);
});
test('inactive geometry is not selected or hovered except through explicit reference hover', () => {
  const f = fixture(), item = { inactive: true };
  f.selection.lines.push(item); f.hover.current.line = item;
  let state = f.presentation.geometryPaintState(item, 'lines');
  assert.equal(state.selected, false); assert.equal(state.hovered, false);
  item.referenceHover = true;
  state = f.presentation.geometryPaintState(item, 'lines');
  assert.equal(state.hovered, true); assert.equal(state.strokeWidth, 2.2); assert.equal(state.showId, true);
  f.hover.current = {}; assert.equal(f.presentation.geometryPaintState(item, 'lines').hovered, false);
});
test('construction dimming and reference selection preserve spline-specific display rules', () => {
  const f = fixture(), item = { construction: true, related: true };
  const line = f.presentation.geometryPaintState(item, 'lines');
  const spline = f.presentation.geometryPaintState(item, 'splines');
  assert.equal(line.alpha, 0.5); assert.equal(spline.alpha, 0.5 * 0.72);
  assert.equal(line.color, '#0ea5e9'); assert.equal(line.strokeWidth, 3);
  assert.equal(line.showId, true); assert.equal(spline.showId, false);
  item.related = false; item.reference = true;
  assert.equal(f.presentation.geometryPaintState(item, 'lines').selected, true);
  assert.equal(f.presentation.geometryPaintState(item, 'splines').selected, false);
  item.sidebar = true;
  assert.equal(f.presentation.geometryPaintState(item, 'circles').construction, false);
  assert.equal(f.presentation.geometryPaintState(item, 'lines').construction, true);
});
test('color and width precedence reads current view flags and keeps fallback widths', () => {
  const f = fixture(), item = {}, appearance = { color: 'normal', lineWidth: 1.5 };
  assert.equal(f.presentation.geometryDisplayColor(item, appearance), 'theme:normal');
  f.view.constraintStatus = true;
  assert.equal(f.presentation.geometryDisplayColor(item, appearance), 'theme:constraint');
  assert.equal(f.presentation.geometryDisplayColor(item, appearance, true, true), 'theme:#1d4ed8');
  assert.equal(f.presentation.geometryStrokeWidth(item, { appearance, selected: true, hovered: true }), 3);
  assert.equal(f.presentation.geometryStrokeWidth(item, { appearance }), 1.5);
  assert.equal(f.presentation.geometryStrokeWidth(item, { construction: true }), 1.1);
  assert.equal(f.presentation.geometryStrokeWidth(item), 2);
  f.view.geometryIds = true; assert.equal(f.presentation.geometryPaintState(item, 'splines').showId, true);
});
