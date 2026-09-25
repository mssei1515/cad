const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['src/document/appearance.js', 'src/document/sketch_hierarchy.js', 'src/persistence/document_files.js', 'src/document/state.js']) {
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
