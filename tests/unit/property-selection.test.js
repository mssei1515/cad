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
