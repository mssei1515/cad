const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/ui/sketch_tree_controller.js', 'utf8'), sandbox);
for (const file of ['src/editing/canvas_hover.js', 'src/editing/selection_highlight.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
function fixture() {
  const block = { id: 'B' }, updates = [], calls = [];
  const controller = sandbox.window.SketchTreeController.create({ currentScope: () => ({ blockInstances: [block] }), activeSketchId: () => 'S1',
    draw: () => calls.push('draw'), hover: { canvasHover: { update: value => updates.push(value) }, clearSidebarHover: () => calls.push('clear'),
      elementSketchId: item => item.sketchId, ROOT_SKETCH_ID: 'root' } });
  const row = (dataset) => ({ dataset, contains: () => false });
  const event = (objectRow, sketchRow = null) => ({ target: { closest: selector => selector === '.sketch-object-row' ? objectRow : sketchRow } });
  return { controller, block, updates, calls, row, event };
}
test('active object hover updates its Canvas target without selecting or activating a sketch', () => {
  const f = fixture(); f.controller.pointerOver(f.event(f.row({ objectKind: 'block', id: 'B', sketchId: 'S1' })));
  assert.equal(f.updates[0].block, f.block); assert.deepEqual(f.calls, ['draw']);
  f.controller.pointerOver(f.event(f.row({ objectKind: 'block', id: 'B', sketchId: 'S2' })));
  assert.equal(f.updates.length, 1);
});
test('sketch hover highlights its members and Root highlights only non-root members', () => {
  const f = fixture(); f.controller.pointerOver(f.event(null, f.row({ id: 'S2' })));
  assert.equal(f.controller.isHighlightedElement({ sketchId: 'S2' }), true);
  assert.equal(f.controller.isHighlightedElement({ sketchId: 'S1' }), false);
  f.controller.pointerOver(f.event(null, f.row({ id: 'root' })));
  assert.equal(f.controller.isHighlightedElement({ sketchId: 'S1' }), true);
  assert.equal(f.controller.isHighlightedElement({ sketchId: 'root' }), false);
  f.controller.clearHoverSketch(); assert.equal(f.controller.isHighlightedElement({ sketchId: 'S1' }), false);
});
test('object exit and full tree leave preserve their distinct clearing scopes', () => {
  const f = fixture(); f.controller.pointerOut(f.event(f.row({})));
  assert.equal(f.updates[0].geometryInstance, null); assert.ok(f.calls.includes('clear'));
  f.controller.leave(); assert.equal(Object.hasOwn(f.updates[1], 'geometryInstance'), false);
  assert.equal(f.updates[1].referenceImage, null);
});

function integratedFixture() {
  const frames = [], item = { id: 'L', sketchId: 'S1' }, dimension = { id: 'D', sketchId: 'S1', dimension: true };
  const scope = { points: [item], constraints: [dimension], blockInstances: [item], geometryInstances: [item] };
  const canvasHover = sandbox.window.CanvasHover.create({ isEndpointPoint: () => false });
  let highlight;
  const draw = () => frames.push({ sidebar: highlight.current, canvas: canvasHover.current });
  highlight = sandbox.window.SelectionHighlight.create({ types: {}, targetFromConstraint: item => item.dimension,
    getHoveredDimension: () => canvasHover.current.dimension, setHoveredDimension: value => canvasHover.update({ dimension: value }), draw });
  const controller = sandbox.window.SketchTreeController.create({ currentScope: () => scope, activeSketchId: () => 'S1', sidebarGeometryItem: () => item, draw,
    hover: { canvasHover, setSidebarHover: highlight.setSidebarHover, clearSidebarHover: highlight.clearSidebarHover,
      sidebarHoverElementsForItem: highlight.sidebarHoverElementsForItem, sidebarHoverElementsForConstraint: highlight.sidebarHoverElementsForConstraint,
      elementSketchId: item => item.sketchId, ROOT_SKETCH_ID: 'root' } });
  const row = dataset => ({ dataset, contains: () => false });
  const event = (objectRow, sketchRow = null) => ({ target: { closest: selector => selector === '.sketch-object-row' ? objectRow : sketchRow } });
  return { frames, item, dimension, scope, canvasHover, highlight, controller, row, event };
}

test('tree geometry hover and exit render once after the complete update; subsequent leave has no stale frame', () => {
  const f = integratedFixture(), row = f.row({ objectKind: 'line', id: 'L', sketchId: 'S1' });
  f.controller.pointerOver(f.event(row)); assert.equal(f.frames.length, 1); assert.equal(f.frames[0].sidebar.item, f.item);
  f.canvasHover.update({ block: f.item, annotation: f.item, hatch: f.item, referenceImage: f.item, geometryInstance: f.item });
  f.controller.pointerOut(f.event(row)); assert.equal(f.frames.length, 2); const frame = f.frames[1];
  assert.equal(frame.sidebar, null);
  for (const field of ['block', 'annotation', 'hatch', 'referenceImage', 'geometryInstance']) assert.equal(frame.canvas[field], null);
  f.controller.leave(); f.controller.pointerOut(f.event(row)); f.controller.leave(); assert.equal(f.frames.length, 2);
});

test('tree dimension exit preserves a newer Canvas dimension and clears Sketch and object hover in one frame', () => {
  const f = integratedFixture(), row = f.row({ objectKind: 'constraint', constraintIndex: '0', sketchId: 'S1' });
  f.controller.pointerOver(f.event(row)); assert.equal(f.frames.length, 1); assert.equal(f.frames[0].canvas.dimension, f.dimension);
  const next = { id: 'next' }; f.canvasHover.update({ dimension: next });
  const sketch = f.row({ id: 'S1' }); f.controller.pointerOver(f.event(null, sketch)); assert.equal(f.controller.isHighlightedElement(f.item), true);
  const before = f.frames.length; f.controller.pointerOut(f.event(row, sketch)); assert.equal(f.frames.length, before + 1);
  assert.equal(f.controller.isHighlightedElement(f.item), false); assert.equal(f.frames.at(-1).canvas.dimension, next); assert.equal(f.highlight.current, null);
  f.controller.leave(); assert.equal(f.frames.length, before + 1);
});

test('direct tree leave clears only its established fields and redraws only when that visible state changed', () => {
  const f = integratedFixture(); f.canvasHover.update({ geometryInstance: f.item, referenceImage: f.item });
  f.controller.leave(); assert.equal(f.frames.length, 1); assert.equal(f.canvasHover.current.geometryInstance, f.item); assert.equal(f.canvasHover.current.referenceImage, null);
  f.controller.leave(); assert.equal(f.frames.length, 1);
  f.controller.pointerOver(f.event(null, f.row({ id: 'S1' }))); const before = f.frames.length;
  f.controller.leave(); assert.equal(f.frames.length, before + 1); assert.equal(f.controller.isHighlightedElement(f.item), false);
});
