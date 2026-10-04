const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
sandbox.window.GeometrySolver = {};
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/selection.js'), 'utf8'), sandbox);
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

function controllerFixture() {
  const calls = [], selection = { inspection: null, sketchId: null }, model = { sketches: [{ id: 'S1' }, { id: 'S2' }, { id: 'S3' }] };
  let active = 'S1';
  selection.set = (key, value) => { selection[key] = value; };
  selection.append = (key, item) => calls.push([key, item]);
  selection.toggleById = (key, item) => calls.push(['toggle', key, item]);
  selection.selectInspection = (target, sketchId, additive) => {
    const state = sandbox.window.CanvasSelection.create();
    state.set('inspection', selection.inspection);
    const changed = state.selectInspection(target, sketchId, additive);
    selection.inspection = state.inspection; selection.sketchId = null;
    return changed;
  };
  const controller = sandbox.window.SketchTreeController.create({
    currentScope: () => model, activeSketchId: () => active, setActiveSketch: id => { active = id; calls.push('activate'); },
    clearSelection: () => { calls.push('clear'); selection.inspection = null; selection.sketchId = null; }, canvasSelection: selection,
    sidebarGeometryItem: (_category, id) => ({ id }), resolveSelectionEntry: data => data.objectKind === 'constraint'
      ? data.fixedPointId ? { point: { id: data.fixedPointId } } : { constraint: model.constraint }
      : { id: data.id }, updateUI: () => calls.push('ui'), draw: () => calls.push('draw'),
    sketchTreeView: { setSketchOpen: () => calls.push('expand') }, deleteElements: () => calls.push('delete'),
  });
  const row = (sketchId, category = 'point', id = 'P1') => ({ dataset: { sketchId, objectKind: category, id } });
  const event = id => { const sketchRow = { dataset: { id } }; return { target: { closest: selector => selector === '.sketch-item' || selector === '.sketchActivateBtn' ? sketchRow : null } }; };
  return { calls, selection, controller, row, event, model, active: () => active };
}

test('inactive objects are inspected without activation or editable Canvas targets', () => {
  const f = controllerFixture();
  for (const category of ['point', 'line', 'circle', 'arc', 'spline', 'hatch', 'image', 'block', 'instance', 'annotation']) {
    f.controller.activateObject(f.row('S2', category), false);
    assert.equal(f.active(), 'S1'); assert.equal(f.selection.inspection.targets[0].item.id, 'P1');
  }
  assert.equal(f.calls.includes('activate'), false);
  assert.equal(f.calls.some(Array.isArray), false);
});

test('inspection adds within one sketch, toggles by ID and ignores additive clicks across sketches', () => {
  const f = controllerFixture();
  f.controller.activateObject(f.row('S2'), false);
  f.controller.activateObject(f.row('S2', 'line', 'L1'), true);
  assert.equal(f.selection.inspection.targets.length, 2);
  f.controller.activateObject(f.row('S2'), true);
  assert.equal(f.selection.inspection.targets.length, 1);
  f.controller.activateObject(f.row('S3'), true);
  assert.equal(f.selection.inspection.targets.length, 1); assert.equal(f.selection.inspection.sketchId, 'S2');
  f.controller.activateObject(f.row('S3'), false);
  f.model.constraint = { name: 'horizontal' };
  f.controller.activateObject(f.row('S3', 'constraint'), true);
  assert.equal(f.selection.inspection.targets[0].kind, 'constraint'); assert.equal(f.selection.inspection.targets.length, 1);
  f.controller.activateObject(f.row('S3'), true);
  assert.equal(f.selection.inspection.targets.length, 1); assert.equal(f.selection.inspection.targets[0].kind, 'geometry');
  f.controller.activateObject(f.row('S1'), true);
  assert.equal(f.selection.inspection.sketchId, 'S3');
  f.controller.activateObject(f.row('S1'), false);
  assert.equal(f.selection.inspection, null); assert.deepEqual(f.calls.at(-3), ['points', { id: 'P1' }]);
});

test('sketch click only selects, double-click and Alt+Enter activate without expanding', () => {
  const f = controllerFixture();
  f.controller.click(f.event('S2'));
  assert.equal(f.active(), 'S1'); assert.equal(f.selection.sketchId, 'S2');
  f.controller.doubleClick(f.event('S2'));
  assert.equal(f.active(), 'S2'); assert.equal(f.selection.sketchId, 'S2'); assert.equal(f.calls.includes('expand'), false);
  const e = { ...f.event('S3'), key: 'Enter', altKey: true, preventDefault() {}, stopPropagation() {} };
  f.controller.keyDown(e); assert.equal(f.active(), 'S3');
});

test('inactive object delete buttons are guarded even if a click is dispatched manually', () => {
  const f = controllerFixture(), row = f.row('S2');
  const action = { closest: () => row };
  f.controller.click({ target: { closest: selector => selector === 'button' ? action : null } });
  assert.deepEqual(f.calls, []);
});
