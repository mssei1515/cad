const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['src/document/appearance.js', 'src/document/sketch_hierarchy.js', 'src/persistence/document_files.js', 'src/document/state.js', 'src/document/drawing_order.js', 'src/geometry/hatch_region.js', 'src/document/annotations.js', 'src/document/hatches.js', 'src/document/reference_images.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
}
const { create, clearContent, resetDefaults } = sandbox.window.DocumentState;

test('documents own their arrays, sketch appearances and units independently', () => {
  const a = create(), b = create();
  a.points.push({ id: 'P1' });
  a.sketches[0].appearance.color = '#ffffff';
  a.units.length = 'changed';
  assert.equal(b.points.length, 0);
  assert.equal(b.sketches[0].appearance.color, undefined);
  assert.equal(b.units.length, 'mm');
  assert.equal(b.activeSketchId, b.sketches[1].id);
  assert.equal(b.sketches[1].parentSketchId, b.sketches[0].id);
  assert.equal(b.defaultAppearance, null);
});

test('content clearing preserves geometry and instance arrays while deferring sketch reset', () => {
  const document = create();
  const arrays = ['points', 'lines', 'circles', 'arcs', 'splines', 'constraints', 'blockDefinitions', 'blockInstances', 'geometryInstances', 'hatches', 'referenceImages'];
  const original = Object.fromEntries(arrays.map(key => [key, document[key]]));
  for (const key of arrays) document[key].push({ id: key });
  document.parameters.push({ name: 'Width' });
  document.nextDimensionParameterIndex = 99;
  document.sketches.push({ id: 'S99' });
  document.activeSketchId = 'S99';
  clearContent(document);
  for (const key of arrays) {
    assert.equal(document[key], original[key]);
    assert.equal(original[key].length, 0);
  }
  assert.equal(document.parameters.length, 0);
  assert.equal(document.nextDimensionParameterIndex, 1);
  assert.equal(document.sketches.length, 3);
  assert.equal(document.activeSketchId, 'S99');
});

test('default reset preserves sketch array and replaces owned ancillary collections', () => {
  const document = create();
  const sketches = document.sketches;
  const points = document.points;
  const hatches = document.hatches;
  document.nextHatchIndex = 33;
  document.annotations.push({ text: 'old' });
  resetDefaults(document);
  assert.equal(document.sketches, sketches);
  assert.equal(document.points, points);
  assert.notEqual(document.hatches, hatches);
  assert.equal(document.annotations.length, 0);
  assert.equal(document.nextHatchIndex, 1);
  assert.equal(document.sketches.length, 2);
  const initialColor = document.defaultAppearance.color;
  document.defaultAppearance.color = 'changed';
  resetDefaults(document);
  assert.equal(document.defaultAppearance.color, initialColor);
});


test('appearance normalization migrates legacy root values into document defaults without replacing geometry', () => {
  const document = create(); resetDefaults(document);
  const root = document.sketches[0], child = document.sketches[1];
  root.appearance = { color: '#ABCDEF', lineWidth: 4 };
  root.constructionAppearance = { color: '#123456' };
  root.dimensionAppearance = { color: '#654321', fontSize: 18 };
  child.appearance = { color: '#999999' };
  const point = { appearance: { color: '#ABCDEF', lineWidth: 99 } };
  document.points.push(point); const points = document.points;
  sandbox.window.DocumentState.normalizeAppearanceState(document, document);
  assert.equal(document.defaultAppearance.color, '#abcdef'); assert.equal(document.defaultAppearance.lineWidth, 4);
  assert.equal(document.defaultConstructionAppearance.color, '#123456');
  assert.equal(document.defaultDimensionAppearance.color, '#654321');
  assert.equal(child.appearance.color, '#999999');
  for (const key of ['appearance', 'constructionAppearance', 'dimensionAppearance']) assert.equal(Object.keys(root[key]).length, 0);
  assert.equal(document.points, points); assert.equal(document.points[0], point);
  assert.equal(point.appearance.color, '#abcdef'); assert.equal(point.appearance.lineWidth, 10);
  const once = JSON.stringify(document);
  sandbox.window.DocumentState.normalizeAppearanceState(document, document);
  assert.equal(JSON.stringify(document), once);
});

test('block scope inherits root appearance into child sketches while document defaults remain independent', () => {
  const document = create(), scope = create(); resetDefaults(document); resetDefaults(scope);
  const defaults = JSON.stringify([document.defaultAppearance, document.defaultConstructionAppearance, document.defaultDimensionAppearance]);
  scope.sketches[0].appearance = { color: '#123456', lineWidth: 3 };
  scope.sketches[0].constructionAppearance = { color: '#654321' };
  scope.sketches[0].dimensionAppearance = { color: '#abcdef' };
  scope.sketches[1].appearance = { lineWidth: 5 };
  const sketch = scope.sketches[1];
  sandbox.window.DocumentState.normalizeAppearanceState(document, scope, { blockEditing: true });
  assert.equal(scope.sketches[1], sketch); assert.equal(sketch.appearance.color, '#123456');
  assert.equal(sketch.appearance.lineWidth, 5); assert.equal(sketch.constructionAppearance.color, '#654321');
  assert.equal(sketch.dimensionAppearance.color, '#abcdef');
  assert.equal(JSON.stringify([document.defaultAppearance, document.defaultConstructionAppearance, document.defaultDimensionAppearance]), defaults);
  assert.equal(Object.keys(scope.sketches[0].appearance).length, 0);
});

test('scope ancillary values are normalized with the first non-root sketch or the legacy fallback', () => {
  for (const withChild of [true, false]) {
    const document = create(); resetDefaults(document);
    if (withChild) document.sketches[1].id = 'S9'; else document.sketches.length = 1;
    document.annotations = [{ type: 'text', text: 'memo', x: '3' }, { type: 'text', sketchId: 'S7' }, null];
    document.hatches = null; document.referenceImages = [{ dataUrl: 'invalid' }];
    sandbox.window.DocumentState.normalizeAppearanceState(document, document);
    assert.equal(document.annotations.length, 2); assert.equal(document.annotations[0].sketchId, withChild ? 'S9' : 'S1');
    assert.equal(document.annotations[1].sketchId, 'S7'); assert.equal(document.annotations[0].x, 3);
    assert.equal(document.hatches.length, 0); assert.equal(document.referenceImages.length, 0);
  }
});
