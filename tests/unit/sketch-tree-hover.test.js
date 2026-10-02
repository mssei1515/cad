const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/ui/sketch_tree_controller.js', 'utf8'), sandbox);
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
