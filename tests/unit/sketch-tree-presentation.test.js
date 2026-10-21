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
function objectFixture({ sharedOwners = false, ...overrides } = {}) {
  const state = { canvasHover: {}, sidebarHover: null }, reads = [];
  const model = { sketches: [{ id: 'S1' }, { id: 'S2' }], points: [], lines: [], circles: [], arcs: [], splines: [], hatches: [], referenceImages: [], blockInstances: [], geometryInstances: [], constraints: [], annotations: [] };
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const ports = { currentScope: () => model, getLanguage: () => 'en', ensureAnalysis() {}, types: {},
    isExplicitPoint: item => item.explicit, isPointUsedByLine: item => item.used, elementSketchId: item => item.sketchId,
    constraintSketchId: item => item.sketchId, constraintStatusOf: item => item.status,
    blockProjectionBundle: instance => instance.bundle, applicationText: (_ja, en) => en, escapeHtml: escape,
    isDimensionConstraint: item => Boolean(item.dimension),
    toolbarSvgMarkup: () => '<svg></svg>', sketchTreeGutter: () => '',
    sketchTreeObjectSelected: () => true,
    readCanvasHover: () => { reads.push('canvas'); return state.canvasHover; },
    readSidebarHover: () => { reads.push('sidebar'); return state.sidebarHover; } };
  Object.assign(ports, overrides);
  const settings = { language: 'en', applicationText: ports.applicationText };
  if (sharedOwners) {
    ports.readServices = { reads: { scopeGeometryItem: ports.sidebarGeometryItem, geometryInstanceBundle: ports.geometryInstanceBundle },
      projections: { blockProjectionBundle: ports.blockProjectionBundle }, catalog: { blockDefinitionById: ports.blockDefinitionById } };
    ports.sketchContext = { elementSketchId: ports.elementSketchId, constraintSketchId: ports.constraintSketchId, activeSketchId: ports.activeSketchId };
    ports.applicationSettings = settings; ports.constraintFeedback = { localizedConstraintName: ports.localizedConstraintName };
    for (const key of ['sidebarGeometryItem','geometryInstanceBundle','blockProjectionBundle','blockDefinitionById',
      'elementSketchId','constraintSketchId','activeSketchId','applicationText','getLanguage','localizedConstraintName']) delete ports[key];
  }
  const objects = sandbox.window.SketchTreeObjects.create(ports);
  return { model, objects, state, reads, settings };
}

test('Tree visibility classification preserves row markup, lazy queries, original targets and current locks', () => {
  const results = [];
  for (const sharedOwners of [false, true]) {
    const calls = [], targetsByEntry = new Map(); let hidden = false, ready = false;
    const isHidden = targets => { assert.equal(ready, true); calls.push(targets); return hidden; };
    const classify = (_category, entry) => !isHidden([targetsByEntry.get(entry)]);
    class Constraint {}
    const f = objectFixture({ sharedOwners, ...(sharedOwners ? { isHidden } : { objectVisible: classify }),
      types: { SketchProjectionConstraint: Constraint, PointPairCenterlineConstraint: Constraint, ParallelLinesCenterlineConstraint: Constraint },
      formatDisplayNumber: String, isSketchProjectedGeometry: () => false, findLineFixedConstraint: () => null,
      blockDefinitionById: () => ({ name: 'block' }), geometryInstanceTypeLabel: String, geometryInstanceBundle: () => ({ valid: true }),
      resolvedHatchBoundary: () => ({ ok: true }), hatchPatternTypeLabel: String, hatchAppearanceForDisplay: () => ({ patternType: 'lines' }),
      localizedConstraintName: String, isReadOnlyDimension: () => false, constraintIsRedundant: () => false,
      referenceConstraintErrorInfo: () => null, constraintToolbarIcon: () => '',
      constraintDirectlyReferencesCanvasSelection: () => false, selectedConstraintReferenceElements: () => [] });
    assert.deepEqual(calls, []); ready = true;
    const point = { id: 'P1', x: 1, y: 2 }, center = { id: 'PC' };
    const entries = [point, { id: 'L1', p1: point, p2: point, length: () => 2 },
      { id: 'C1', center, radius: () => 3 }, { id: 'A1', center, radius: () => 3 },
      { id: 'SP1', fitPoints: [point] }, { id: 'H1' }, { id: 'B1', definitionId: 'BD1' },
      { id: 'GI1', type: 'pattern' }, { constraint: { name: 'distance', dimension: {} }, modelIndex: 0 }];
    const categories = ['point','line','circle','arc','spline','hatch','block','instance','dimension'];
    const kinds = ['geometry','geometry','geometry','geometry','geometry','hatch','block','geometryInstance','constraint'];
    entries.forEach((entry, index) => targetsByEntry.set(entry, { kind: kinds[index], item: index === 8 ? entry.constraint : entry }));
    const html = [];
    for (const [index, category] of categories.entries()) {
      const entry = entries[index], before = JSON.stringify(entry); hidden = false;
      html.push(f.objects.row(category, entry, [], 'S1')); assert.match(html.at(-1), /aria-pressed="true"/);
      assert.equal(calls.at(-1)[0].item, targetsByEntry.get(entry).item);
      assert.equal(calls.at(-1)[0].kind, targetsByEntry.get(entry).kind);
      hidden = true; html.push(f.objects.row(category, entry, [], 'S1')); assert.match(html.at(-1), /aria-pressed="false"/);
      assert.equal(JSON.stringify(entry), before);
    }
    f.model.sketches[0].locked = true; html.push(f.objects.row('point', point, [], 'S1')); assert.match(html.at(-1), /<button disabled /);
    results.push(html);
    if (sharedOwners) { f.settings.language = 'ja'; assert.match(f.objects.summary('S1', { point: [], line: [], circle: [], arc: [], spline: [] }, []), /完全拘束/); }
  }
  assert.deepEqual(results[0], results[1]);
});

test('shared readers retain raw query calls and explicit visibility and language overrides take precedence', () => {
  const item = { id: 'L1' }, calls = [];
  const f = objectFixture({ sharedOwners: true, sidebarGeometryItem: function(category, id) {
    'use strict'; assert.equal(this, undefined); calls.push([category, id]); return item;
  } });
  assert.deepEqual(calls, []);
  assert.equal(f.objects.resolveSelectionEntry({ objectKind: 'line', id: 'L1' }), item);
  assert.deepEqual(calls, [['line', 'L1']]);
  const marker = new Error('visibility failed');
  const overridden = objectFixture({ applicationSettings: { language: 'ja', applicationText: () => { throw marker; } },
    isHidden: () => { throw marker; }, objectVisible: () => false, formatDisplayNumber: String, isSketchProjectedGeometry: () => false });
  assert.match(overridden.objects.row('point', { id: 'P1', x: 1, y: 2 }, [], 'S1'), /aria-pressed="false"/);
  assert.match(overridden.objects.summary('S1', { point: [], line: [], circle: [], arc: [], spline: [] }, []), /Fully constrained/);
  const failing = objectFixture({ isHidden: () => { throw marker; }, formatDisplayNumber: String, isSketchProjectedGeometry: () => false });
  assert.throws(() => failing.objects.row('point', { id: 'P1', x: 1, y: 2 }, [], 'S1'), error => error === marker);
});

test('Tree hover reads only the current Canvas source for attachments and instances and keeps object identity', () => {
 const f = objectFixture(); assert.deepEqual(f.reads, []);
 for (const [category, field] of [['hatch', 'hatch'], ['image', 'referenceImage'], ['block', 'block'], ['instance', 'geometryInstance'], ['annotation', 'annotation']]) {
  const item = { id: 'same' }, hover = { [field]: item }; f.state.canvasHover = hover; f.state.sidebarHover = { item: { id: 'same' } };
  f.reads.length = 0; assert.equal(f.objects.hovered(category, item), true); assert.deepEqual(f.reads, ['canvas']);
  assert.equal(f.objects.hovered(category, { id: 'same' }), false);
  f.state.canvasHover = {}; assert.equal(f.objects.hovered(category, item), false);
  assert.equal(hover[field], item);
 }
});

test('Tree geometry and constraint hover use the current Sidebar object and resolve fixed-point and dimension entries', () => {
 const f = objectFixture(), point = { id: 'P1' }, constraint = { id: 'K1' }, line = { id: 'L1' };
 for (const [category, entry, item] of [['line', line, line], ['constraint', { kind: 'fixed-point', point }, point],
  ['constraint', { constraint }, constraint], ['dimension', { constraint }, constraint]]) {
  f.state.sidebarHover = { item }; f.reads.length = 0;
  assert.equal(f.objects.hovered(category, entry), true); assert.deepEqual(f.reads, ['sidebar']);
  f.state.sidebarHover = { item: { id: item.id } }; assert.equal(f.objects.hovered(category, entry), false);
  f.state.sidebarHover = null; assert.equal(f.objects.hovered(category, entry), false);
 }
});

test('Tree rows reflect hover changes without changing source objects or writing to hover owners', () => {
 const f = objectFixture(), image = { id: 'I1', name: 'image', pixelWidth: 20, pixelHeight: 30 }, before = JSON.stringify(image);
 const row = () => f.objects.row('image', image, [], 'S1');
 assert.equal(row().includes('sidebar-related'), false);
 f.state.canvasHover = { referenceImage: image }; assert.equal(row().includes('sidebar-related'), true);
 const snapshot = f.state.canvasHover; f.state.sidebarHover = { item: image };
 assert.equal(row().includes('sidebar-related'), true); assert.equal(f.state.canvasHover, snapshot);
 f.state.canvasHover = {}; assert.equal(row().includes('sidebar-related'), false);
 assert.equal(JSON.stringify(image), before); assert.equal(f.state.sidebarHover.item, image);
});
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

test('dimension category separates constraint and reference dimensions while retaining model indices', () => {
  const f = objectFixture();
  f.model.constraints.push({ sketchId: 'S1', dimension: {} }, { sketchId: 'S1' }, { sketchId: 'S1', dimension: {}, readOnlyDimension: true });
  const groups = f.objects.index().get('S1');
  assert.deepEqual(Array.from(groups.dimension, entry => entry.modelIndex), [0, 2]);
  assert.deepEqual(Array.from(groups.constraint, entry => entry.modelIndex), [1]);
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
    deleteCurrentSelection: () => calls.push('delete-selection'),
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

test('block, hatch and instance delete buttons target only their row without switching drawing sketch', () => {
  for (const [category, id, field, buttonClass] of [['block', 'B1', 'blockInstances', 'removeBlockBtn'], ['hatch', 'H1', 'hatches', 'removeHatchBtn'], ['instance', 'I1', 'geometryInstances', 'removeInstanceBtn']]) {
    const f = controllerFixture(), row = f.row('S2', category, id);
    f.selection.append('points', f.model.points[0]);
    const action = { closest: () => row, classList: { contains: name => name === buttonClass } };
    f.controller.click({ target: { closest: selector => selector === 'button' ? action : null } });
    assert.equal(f.selection[field][0].id, id);
    assert.equal(f.selection.points.length, 0);
    assert.equal(f.calls.filter(call => call === 'delete-selection').length, 1);
    assert.equal(f.active(), 'S1');
  }
});
