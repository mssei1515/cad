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
  const calls = [], selection = sandbox.window.CanvasSelection.create();
  const model = { sketches: [{ id: 'S1' }, { id: 'S2' }, { id: 'S3' }], points: [], lines: [], circles: [], arcs: [], splines: [], hatches: [], referenceImages: [], blockInstances: [], geometryInstances: [], constraints: [], annotations: [] };
  for (const [field, id] of [['points','P1'], ['lines','L1'], ['circles','C1'], ['arcs','A1'], ['splines','SP1'], ['hatches','H1'], ['referenceImages','IMG1'], ['blockInstances','B1'], ['geometryInstances','I1'], ['annotations','AN1']]) model[field].push({ id, sketchId: 'S2' });
  let active = 'S1';
  const controller = sandbox.window.SketchTreeController.create({
    currentScope: () => model, activeSketchId: () => active, setActiveSketch: id => { active=id; calls.push('activate'); },
    clearSelection: () => selection.clear(), canvasSelection: selection,
    selectionSketchId: () => Object.values(selection).filter(Array.isArray).flat()[0]?.sketchId,
    guardSketchEdit: id => !model.sketches.find(s=>s.id===id)?.locked,
    sidebarGeometryItem: (category,id) => model[category+'s'].find(item=>item.id===id),
    toggleBlockInstanceSelection: selection.toggleBlockInstanceSelection,
    targetFromConstraint: () => false,
    updateUI: () => calls.push('ui'), draw: () => calls.push('draw'),
    sketchTreeView: { setSketchOpen: () => calls.push('expand') }, deleteElements: () => calls.push('delete'),
  });
  const row=(sketchId,category='point',id='P1')=>({dataset:{sketchId,objectKind:category,id}});
  const event=id=>{const sketchRow={dataset:{id}}; return {target:{closest:selector=>selector==='.sketch-item'||selector==='.sketchActivateBtn'?sketchRow:null}};};
  return {calls,selection,controller,row,event,model,active:()=>active};
}
test('other sketch objects share editable selection without changing drawing destination', () => {
 const f=controllerFixture();
 for(const [category,id,field] of [['point','P1','points'],['line','L1','lines'],['circle','C1','circles'],['arc','A1','arcs'],['spline','SP1','splines'],['hatch','H1','hatches'],['image','IMG1','referenceImages'],['block','B1','blockInstances'],['instance','I1','geometryInstances'],['annotation','AN1','annotations']]) {
   f.controller.activateObject(f.row('S2',category,id),false);
   assert.equal(f.active(),'S1'); assert.equal(f.selection[field][0].id,id); assert.equal(f.selection.inspection,null);
 }
});
test('tree additive selection toggles within the owner and ignores another sketch', () => {
 const f=controllerFixture();
 f.controller.activateObject(f.row('S2'),false);
 f.controller.activateObject(f.row('S2','line','L1'),true);
 assert.equal(f.selection.points.length+f.selection.lines.length,2);
 f.controller.activateObject(f.row('S2'),true); assert.equal(f.selection.points.length,0);
 f.controller.activateObject(f.row('S3'),true); assert.equal(f.selection.lines.length,1);
 assert.equal(f.selection.points.length,0);
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

test('locked object delete buttons are guarded even if a click is dispatched manually', () => {
  const f = controllerFixture(), row = f.row('S2');
  f.model.sketches.find(s=>s.id==='S2').locked=true;
  const action = { closest: () => row };
  f.controller.click({ target: { closest: selector => selector === 'button' ? action : null } });
  assert.deepEqual(f.calls, []);
});
