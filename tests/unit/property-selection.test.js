const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['document/appearance', 'editing/property_selection', 'editing/appearance_editing', 'commands/bulk_property_command']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', `${file}.js`), 'utf8'), sandbox);
}
const w = sandbox.window, appearance = w.Appearance;
class Point {} class Line {}
function fixture() {
  const selection = { geometryInstances: [], referenceImages: [], hatches: [], annotations: [], blockInstances: [] }, geometry = [], operation = {}, sketch = {};
  const query = w.PropertySelection.create({ Point, Line, canvasSelection: selection, getOperation: () => operation,
    effectiveSelectedConstraint: () => selection.constraint, selectedGeometryItems: () => geometry,
    blockDefinitionById: id => ({ id }), sketchById: () => sketch, activeSketchId: () => 'S1',
    blockProjectionBundle: () => ({}), effectiveAppearanceForElement: item => appearance.normalizeAppearance(item.appearance, { partial: false }),
    documentModel: { defaultAppearance: {} }, normalizeAppearance: appearance.normalizeAppearance,
    hatchAppearanceForDisplay: item => appearance.normalizeHatchAppearance(item.appearance), normalizeAnnotationStyle: appearance.normalizeAnnotationStyle });
  const editing = w.AppearanceEditing.create({ ...appearance, defaultDimensionAppearance: appearance.DEFAULT_DIMENSION_APPEARANCE, dimensionNumericRules: appearance.DIMENSION_APPEARANCE_NUMERIC_RULES });
  return { selection, geometry, operation, sketch, query, editing };
}
test('property targets prioritize operation and constraint state, falling back to active sketch', () => {
  const f = fixture(); assert.equal(f.query.selectedPropertiesTarget().item, f.sketch);
  const point = new Point(); f.geometry.push(point);
  assert.equal(f.query.selectedPropertiesTarget().item, point);
  f.selection.constraint = {}; assert.equal(f.query.selectedPropertiesTarget().kind, 'constraint');
  f.operation.mode = 'block-place'; f.operation.blockPlacementDefinitionId = 'B1';
  assert.equal(f.query.selectedPropertiesTarget().kind, 'blockPlacement');
  f.operation.freeInstancePlacement = {}; assert.equal(f.query.selectedPropertiesTarget().item, f.operation.freeInstancePlacement);
  f.operation.mode = 'instance-sources'; f.operation.instanceSourceEdit = { instance: {} };
  assert.equal(f.query.selectedPropertiesTarget().item, f.operation.instanceSourceEdit.instance);
});
test('common values use effective appearance and mixed sentinel while inherited resets remove overrides', () => {
  const f = fixture(), a = new Line(), b = new Line();
  a.appearance = { color: '#111827' }; b.appearance = {};
  const target = { kind: 'multiple', items: [{ kind: 'geometry', item: a }, { kind: 'geometry', item: b }] };
  assert.equal(f.query.multiplePropertySameType(target), true);
  assert.equal(f.query.multiplePropertyValue(target, 'color'), '#111827');
  b.appearance.color = '#ffffff'; assert.equal(f.query.multiplePropertyValue(target, 'color'), w.PropertySelection.mixedValue);
  f.editing.applyAppearanceInput(b.appearance, 'color', ''); assert.equal(Object.hasOwn(b.appearance, 'color'), false);
  const owner = { precision: 4, prefix: 'X' };
  f.editing.applyDimensionAppearanceValue(owner, 'precision', '');
  assert.equal(Object.hasOwn(owner, 'precision'), false); assert.equal(owner.prefix, 'X');
});
test('bulk construction rejection is atomic and preview changes omit history until committed', () => {
  const f = fixture(), calls = [], line = new Line(); let allow = false;
  const target = { kind: 'multiple', items: [{ kind: 'geometry', item: line }] };
  const command = w.BulkPropertyCommand.create({ ...f.editing, normalizeHatchAppearance: appearance.normalizeHatchAppearance,
    guardSketchProjectionShapeEdit: () => allow, applicationText: value => value, multiplePropertySupports: f.query.multiplePropertySupports,
    updatePropertiesUI: () => calls.push('properties'), draw: () => calls.push('draw'), invalidateBlockProjectionCache() {},
    synchronizeSketchProjectionMetadata: () => calls.push('sync'), recordHistory: () => calls.push('history'), updateUI: () => calls.push('ui') });
  assert.equal(command.apply(target, 'construction', true), false); assert.equal(line.construction, undefined);
  allow = true; calls.length = 0;
  assert.equal(command.apply(target, 'construction', true, { commit: false }), true);
  assert.equal(line.construction, true); assert.deepEqual(calls, ['sync', 'draw']);
  calls.length = 0; command.apply(target, 'construction', false);
  assert.deepEqual(calls, ['sync', 'history', 'ui', 'draw']);
});


test('explicit sketch and inspection targets are independent of the active sketch', () => {
  const f = fixture(), item = new Point();
  f.selection.sketchId = 'S2';
  assert.equal(f.query.selectedPropertiesTarget().active, false);
  f.selection.sketchId = null;
  f.selection.inspection = { sketchId: 'S2', targets: [{ kind: 'geometry', item }] };
  let target = f.query.selectedPropertiesTarget(); assert.equal(target.item, item); assert.equal(target.readOnly, true);
  f.selection.inspection.targets.push({ kind: 'annotation', item: {} });
  target = f.query.selectedPropertiesTarget(); assert.equal(target.kind, 'multiple'); assert.equal(target.readOnly, true);
  f.selection.inspection = null; assert.equal(f.query.selectedPropertiesTarget().active, true);
});

test('bulk size lock captures only newly locked baselines and commits once', () => {
 const f=fixture(),a={value:100,dimension:{offset:30,display:{}}},b={value:160,dimension:{offset:40,display:{fixedDisplaySize:false,displayScale:2}}};
 const target={kind:'multiple',items:[{kind:'constraint',item:a},{kind:'constraint',item:b}]};
 assert.equal(f.query.multiplePropertyValue(target,'modelRelativeSize'),w.PropertySelection.mixedValue);
 assert.equal(f.query.multiplePropertySupports({kind:'geometry',item:new Line()},'modelRelativeSize'),false);
 const viewport={scale:appearance.CSS_PX_PER_MM*1.5};let commits=0;
 const command=w.BulkPropertyCommand.create({viewport,multiplePropertySupports:f.query.multiplePropertySupports,draw(){},recordHistory(){commits++;},updateUI(){}});
 command.apply(target,'modelRelativeSize',true);
 assert.equal(a.dimension.display.displayScale,1.5);assert.equal(b.dimension.display.displayScale,2);
 assert.equal(f.query.multiplePropertyValue(target,'modelRelativeSize'),true);assert.equal(commits,1);
 viewport.scale*=2;command.apply(target,'modelRelativeSize',false);
 for(const item of [a,b]) {assert.equal(item.dimension.display.fixedDisplaySize,true);assert.equal(Object.hasOwn(item.dimension.display,'displayScale'),false);}
 assert.equal(f.query.multiplePropertyValue(target,'modelRelativeSize'),false);assert.equal(commits,2);
 assert.equal(a.value,100);assert.equal(b.value,160);assert.equal(a.dimension.offset,30);assert.equal(b.dimension.offset,40);
});

test('bulk dimension appearance preserves independent measurement and placement', () => {
 const f=fixture(),a={value:100,dimension:{offset:30,display:{}}},b={value:160,dimension:{offset:40,display:{}}};
 f.selection.dimensionConstraints=[a,b]; const target=f.query.selectedPropertiesTarget(); assert.equal(target.kind,'multiple'); assert.equal(target.count,2);
 const command=w.BulkPropertyCommand.create({...f.editing, multiplePropertySupports:f.query.multiplePropertySupports, draw(){},recordHistory(){},updateUI(){}});
 command.apply(target,'prefix',' custom '); command.apply(target,'color','#ff0000'); command.apply(target,'precision','2');
 for(const item of [a,b]) assert.deepEqual(item.dimension.display,{prefix:' custom ',color:'#ff0000',precision:2});
 assert.equal(a.value,100);assert.equal(b.value,160);assert.equal(a.dimension.offset,30);assert.equal(b.dimension.offset,40);
 f.geometry.push(new Line());assert.equal(f.query.selectedPropertiesTarget().count,3);
 assert.equal(f.query.multiplePropertySupports({kind:'constraint',item:a},'lineType'),false);
 assert.equal(f.query.multiplePropertySupports({kind:'constraint',item:a},'value'),false);
});
