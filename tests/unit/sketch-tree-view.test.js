const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/sketch_tree_view.js'), 'utf8'), sandbox);
function fixture() {
  const handlers = {}, attrs = {}, classes = new Set(); let scope = 'document', areaWidth = 500;
  const list = {}, label = {}, sketch = { id: 'S1', name: 'Sketch' };
  const overlay = { style: {}, parentElement: { getBoundingClientRect: () => ({ width: areaWidth }) },
    getBoundingClientRect: () => ({ width: Number.parseFloat(overlay.style.width) }),
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
  const handle = { addEventListener: (name, callback) => { handlers[name] = callback; },
    setAttribute: (name, value) => { attrs[name] = value; }, setPointerCapture: () => {} };
  const view = sandbox.window.SketchTreeView.create({
    document: { getElementById: id => id === 'sketchList' ? list : label }, sketchOverlay: overlay, sketchOverlayResizeHandle: handle,
    getScopeKey: () => scope, currentScope: () => ({ sketches: [sketch] }), ensureSketchState() {}, isRootSketch: () => false,
    activeSketchId: () => 'S1', applicationText: (_ja, en) => en, escapeHtml: String,
    objects: { index: () => new Map([['S1', { point: [{ id: 'P1' }], line: [], circle: [], arc: [], spline: [], hatch: [], image: [], block: [], instance: [], constraint: [], annotation: [] }]]), row: () => '<point-row>', selected: () => false, hovered: () => false, summary: () => '' },
    sketchHasSolveError: () => false, referenceConstraintErrorCountForSketch: () => 0, constraintDuplicateCountForSketch: () => 0, actions: {},
  });
  return { view, list, overlay, handlers, attrs, classes, setScope: value => { scope = value; }, setArea: value => { areaWidth = value; },
    event: (type, values = {}) => handlers[type]({ preventDefault() {}, stopPropagation() {}, ...values }) };
}
test('expansion is isolated by editing scope and capture survives reset and later edits', () => {
  const f = fixture(); f.view.render(); assert.equal(f.list.innerHTML.includes('<point-row>'), false);
  f.view.setSketchOpen('S1', true); f.view.toggleGroup('S1', 'point'); f.view.render();
  assert.equal(f.list.innerHTML.includes('<point-row>'), true);
  const state = f.view.capture(); f.setScope('block:B1'); f.view.render();
  assert.equal(f.list.innerHTML.includes('<point-row>'), false);
  f.view.setSketchOpen('S1', true); f.view.toggleGroup('S1', 'point');
  f.view.reset(); f.view.restore(state); f.view.render();
  assert.equal(f.list.innerHTML.includes('<point-row>'), false);
  f.setScope('document'); f.view.render(); assert.equal(f.list.innerHTML.includes('<point-row>'), true);
  f.view.toggleGroup('S1', 'point'); f.view.restore(state); f.view.render();
  assert.equal(f.list.innerHTML.includes('<point-row>'), true);
});
test('resize clamps to available canvas width and only the active pointer changes the width', () => {
  const f = fixture(); assert.equal(f.overlay.style.width, '320px');
  f.event('pointerdown', { button: 0, pointerId: 1, clientX: 100 });
  f.event('pointermove', { pointerId: 2, clientX: 200 }); assert.equal(f.overlay.style.width, '320px');
  f.event('pointermove', { pointerId: 1, clientX: 1000 }); assert.equal(f.overlay.style.width, '476px');
  f.event('pointerup', { pointerId: 2 }); assert.equal(f.classes.has('resizing'), true);
  f.event('pointercancel', { pointerId: 1 }); assert.equal(f.classes.has('resizing'), false);
  f.event('keydown', { key: 'Home' }); assert.equal(f.overlay.style.width, '220px');
  f.event('keydown', { key: 'ArrowRight' }); assert.equal(f.overlay.style.width, '236px');
  f.setArea(200); f.view.applyWidth(); assert.equal(f.overlay.style.width, '176px');
  assert.equal(f.attrs['aria-valuenow'], '176'); assert.equal(f.attrs['aria-valuemax'], '176');
});
