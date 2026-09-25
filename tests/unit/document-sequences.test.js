const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['src/editing/geometry_ids.js', 'src/persistence/document_sequences.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
}
const { recover } = sandbox.window.DocumentSequences;
const items = (...ids) => ids.map(id => ({ id }));

test('recovered IDs cover document and all definitions without mutating either', () => {
  const model = { points: items('P8'), sketches: items('S9'), annotations: items('AN2'), blockInstances: items('BI3') };
  const definitions = [{ id: 'B4', points: items('P30'), lines: items('L40'), splines: items('SP50'), sketches: items('S20'), annotations: items('AN21'), blockInstances: items('BI22') }];
  const before = JSON.stringify({ model, definitions });
  const result = recover(model, definitions);
  const allocator = sandbox.window.GeometryIds.create();
  allocator.reserve(result.geometry);
  assert.equal(allocator.allocate('point'), 'P31');
  assert.equal(allocator.allocate('line'), 'L41');
  assert.equal(allocator.allocate('spline'), 'SP51');
  assert.equal(result.blockElementSeq, 51);
  assert.equal(result.sketchSeq, 21);
  assert.equal(result.annotationSeq, 22);
  assert.equal(result.blockDefinitionSeq, 5);
  assert.equal(result.blockInstanceSeq, 23);
  assert.equal(result.geometry.points[0], model.points[0]);
  assert.equal(JSON.stringify({ model, definitions }), before);
});

test('hatch reservations survive deleted IDs and include definition reservations', () => {
  const model = { hatches: items('H8'), nextHatchIndex: 30, referenceImages: items('IMG2') };
  const definitions = [{ hatches: items('H20'), nextHatchIndex: 70, referenceImages: items('IMG50') }];
  assert.equal(recover(model, definitions).hatchSeq, 70);
  definitions[0].hatches.push(...items('H90'));
  assert.equal(recover(model, definitions).hatchSeq, 91);
  assert.equal(recover(model, definitions).referenceImageSeq, 51);
});

test('derived instance prefixes are independent and qualified projection IDs do not reserve local IDs', () => {
  const result = recover({ points: items('BI1:P999'), geometryInstances: items('SPI2', 'FI3') }, [
    { points: items('BI9:P500'), geometryInstances: items('SPI8', 'MI10', 'PI11', 'FI12') },
  ]);
  assert.equal(result.sketchProjectionInstanceSeq, 9);
  assert.equal(result.freeInstanceSeq, 13);
  assert.equal(result.mirrorInstanceSeq, 11);
  assert.equal(result.patternInstanceSeq, 12);
  assert.equal(result.blockElementSeq, 1);
  const allocator = sandbox.window.GeometryIds.create();
  allocator.reserve(result.geometry);
  assert.equal(allocator.allocate('point'), 'P1');
});

test('empty document starts every sequence at one', () => {
  const { geometry, ...sequences } = recover({}, []);
  for (const value of Object.values(sequences)) assert.equal(value, 1);
  for (const values of Object.values(geometry)) assert.equal(values.length, 0);
});
