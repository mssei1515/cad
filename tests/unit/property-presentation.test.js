const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['editing/property_presentation', 'ui/property_rows', 'ui/properties_content']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', `${file}.js`), 'utf8'), sandbox);
}
const empty = () => ({ lines: [], circles: [], arcs: [], splines: [], points: [] });

test('instance presentation follows placement and source-edit state without changing stored sources', () => {
  const item = { id: 'I1', sketchId: 'S1', sources: [{ kind: 'line', id: 'L1' }] };
  const operation = { freeInstancePlacement: item, mode: 'free-instance-place' }, selection = {};
  let scope = { geometryInstances: [] }, bundleCalls = 0;
  const query = sandbox.window.PropertyPresentation.create({
    currentScope: () => scope, getOperation: () => operation, canvasSelection: selection,
    documentModel: { defaultAppearance: { color: '#123456' } }, normalizeAppearance: value => value,
    emptyGeometryInstanceBundle: empty, geometryInstanceBundle: () => { bundleCalls++; return { ...empty(), valid: true }; },
    activeSketchId: () => 'S1',
  });
  const target = { kind: 'geometryInstance', item }, placed = query.read(target);
  assert.equal(placed.bundle.valid, true); assert.equal(placed.placing, true); assert.equal(placed.canEditSources, false); assert.equal(bundleCalls, 0);
  operation.freeInstancePlacement = null; operation.mode = 'instance-sources';
  operation.instanceSourceEdit = { instance: item, sources: [{ kind: 'line', id: 'L2' }] };
  scope = { geometryInstances: [item] }; selection.instanceGeometry = { instanceId: item.id };
  const editing = query.read(target);
  assert.equal(editing.sources[0].id, 'L2'); assert.equal(item.sources[0].id, 'L1');
  assert.equal(editing.canEditSources, true); assert.equal(editing.editingSources, true); assert.equal(editing.editingSharedShape, true); assert.equal(bundleCalls, 1);
});

test('placement presentation copies enabled sketch IDs and root sketch skips appearance resolution', () => {
  const operation = { blockPlacementEnabledSketchIds: ['S1'], blockPlacementRotationLocked: true };
  const query = sandbox.window.PropertyPresentation.create({ getOperation: () => operation,
    blockDefinitionSketchRows: () => [], sketchById: () => null, isRootSketch: () => true,
    effectiveAppearanceForSketch: () => { throw new Error('Root has no appearance controls'); },
  });
  const view = query.read({ kind: 'blockPlacement', item: {} });
  view.enabledSketchIds.push('S2'); assert.deepEqual(operation.blockPlacementEnabledSketchIds, ['S1']);
  assert.equal(view.rotationLocked, true);
  assert.equal(query.read({ kind: 'sketch', item: {} }).root, true);
});

test('reference image markup uses resolved sketch names and keeps locked controls and escaped user content', () => {
  const format = { applicationText: (_ja, en) => en, formatDisplayNumber: String,
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;') };
  const content = sandbox.window.PropertiesContent.create({ ...format,
    presentation: { read: () => ({ owningSketchName: '<sketch>' }) },
    rows: sandbox.window.PropertyRows.create(format), appearanceControls: {},
  });
  const html = content.render({ kind: 'referenceImage', item: { id: 'IMG1', sketchId: 'S1', name: '"<image>', locked: true,
    pixelWidth: 10, pixelHeight: 20, scale: 2, x: 0, y: 0, rotation: 0, opacity: 0.5 } });
  assert.ok(html.includes('&lt;sketch> (S1)')); assert.ok(html.includes('&quot;&lt;image>'));
  assert.match(html, /data-reference-image-property="width"[^>]*value="20" disabled/);
  assert.match(html, /data-property-action="reference-image-calibrate" disabled/);
});
