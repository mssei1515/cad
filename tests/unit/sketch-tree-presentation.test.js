const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['sketch_tree_objects', 'sketch_tree_controller']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui', `${file}.js`), 'utf8'), sandbox);
}
function objectFixture() {
  const model = { sketches: [{ id: 'S1' }, { id: 'S2' }], points: [], lines: [], circles: [], arcs: [], splines: [], hatches: [], referenceImages: [], blockInstances: [], geometryInstances: [], constraints: [], annotations: [] };
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const objects = sandbox.window.SketchTreeObjects.create({ currentScope: () => model, getLanguage: () => 'en', ensureAnalysis() {}, types: {},
    isExplicitPoint: item => item.explicit, isPointUsedByLine: item => item.used, elementSketchId: item => item.sketchId,
    constraintSketchId: item => item.sketchId, constraintStatusOf: item => item.status,
    blockProjectionBundle: instance => instance.bundle, applicationText: (_ja, en) => en, escapeHtml: escape,
    toolbarSvgMarkup: () => '<svg></svg>', sketchTreeGutter: () => '',
    sketchTreeObjectSelected: () => true, sketchTreeObjectHovered: () => false });
  return { model, objects };
}
test('tree index keeps source constraint indices and includes hidden fixed points only as constraints', () => {
  const f = objectFixture();
  const point = { id: 'P1', sketchId: 'S1', fixed: true }, explicit = { id: 'P2', sketchId: 'S2', explicit: true };
  f.model.points.push(point, explicit);
  f.model.constraints.push({ sketchId: 'S2' }, { sketchId: 'S1' });
  const groups = f.objects.index();
  assert.equal(groups.get('S1').point.length, 0); assert.equal(groups.get('S2').point[0], explicit);
  assert.equal(groups.get('S1').constraint[0].modelIndex, 1);
  assert.equal(groups.get('S1').constraint[1].point, point);
});
test('object labels are escaped and constraint summaries include only blocks owned by the requested sketch', () => {
  const f = objectFixture();
  const image = { id: 'I"1', name: '<img src=x>', pixelWidth: 20, pixelHeight: 30, visible: false, locked: true };
  const html = f.objects.row('image', image, [], 'S"1');
  assert.ok(html.includes('&lt;img src=x&gt;')); assert.ok(html.includes('data-id="I&quot;1"'));
  assert.ok(html.includes('selected sidebar-selected')); assert.ok(html.includes('Hidden')); assert.ok(html.includes('Locked'));
  f.model.blockInstances.push({ sketchId: 'S1', bundle: { lines: [{ status: 'full' }], circles: [], arcs: [] } },
    { sketchId: 'S2', bundle: { lines: [{ status: 'conflict' }], circles: [], arcs: [] } });
  const counts = f.objects.summaryCounts('S1', { point: [{ status: 'under' }], line: [], circle: [], arc: [], spline: [] });
  assert.equal(counts.full, 1); assert.equal(counts.under, 1); assert.equal(counts.conflict, 0);
});
test('switching sketch disables additive selection and refreshes after selecting the target object', () => {
  const calls = [], point = { id: 'P1' }; let active = 'S1';
  const controller = sandbox.window.SketchTreeController.create({
    currentScope: () => ({}), activeSketchId: () => active, setActiveSketch: id => { active = id; calls.push('activate'); },
    clearSelection: () => calls.push('clear'), canvasSelection: { append: (kind, item) => calls.push([kind, item]), toggleById: () => assert.fail('must not toggle across sketches') },
    sidebarGeometryItem: () => point, updateUI: () => calls.push('ui'), draw: () => calls.push('draw'),
  });
  controller.activateObject({ dataset: { sketchId: 'S2', objectKind: 'point', id: 'P1' } }, true);
  assert.deepEqual(calls, ['activate', 'clear', ['points', point], 'ui', 'draw']);
});
