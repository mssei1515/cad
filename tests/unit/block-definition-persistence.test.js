const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/geometry/hatch_region.js', 'src/solver/constraint_solver.js', 'src/document/appearance.js', 'src/document/drawing_order.js', 'src/document/sketch_hierarchy.js', 'src/document/annotations.js', 'src/document/hatches.js', 'src/document/reference_images.js', 'src/persistence/geometry.js', 'src/persistence/block_definitions.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
const codec = sandbox.window.BlockDefinitionPersistence.create({ applicationText: (_ja, en) => en, serializedGeometryInstanceListError: () => '' });
const raw = () => ({ id: 'B1', sketches: [{ id: 'S1', kind: 'sketch' }], activeSketchId: 'S1', points: [{ id: 'P1', x: 0, y: 0 }, { id: 'P2', x: 1, y: 2 }], lines: [{ id: 'L1', p1: 'P1', p2: 'P2' }], circles: [], arcs: [], splines: [], hatches: [], nextHatchIndex: 1, referenceImages: [], geometryInstances: [], parameters: [{ name: 'width', expression: '12' }] });
const decode = (data, sourceVersion = 22) => codec.decode([data], { sourceVersion, normalizeLoadedExpression: value => String(value ?? ''), normalizeLoadedDimensionAppearance: value => value || {} });
test('block decode creates geometry and metadata without resolving instances or constraints', () => {
  const data = raw(), result = decode(data), definition = result.definitions[0];
  assert.equal(definition.lines[0].p1, definition.points[0]); assert.notEqual(definition.points[0], data.points[0]);
  assert.equal(result.metadata.get('B1').rawDefinition, data); assert.equal(result.metadata.get('B1').normalizeDefinitionSketchId('missing'), 'S1');
  assert.equal(definition.parameters[0].expression, '12'); assert.equal(definition.constraints.length, 0); assert.equal(definition.blockInstances.length, 0); assert.equal(definition.parentDefinitionId, null);
});
for (const [field, message] of [['splines', /spline array/], ['referenceImages', /reference image/], ['geometryInstances', /derived instance array/], ['hatches', /hatch data/], ['nextHatchIndex', /hatch sequence/]]) {
  test(`current block format rejects missing ${field}`, () => { const data = raw(); delete data[field]; assert.throws(() => decode(data), message); });
}
test('legacy blocks accept absent newer collections and normalize annotations into their active sketch', () => {
  const data = raw(); for (const key of ['splines', 'referenceImages', 'geometryInstances', 'hatches', 'nextHatchIndex']) delete data[key];
  data.annotations = [{ id: 'A1', type: 'text', x: 0, y: 0, text: 'note' }];
  const definition = decode(data, 10).definitions[0]; assert.equal(definition.annotations[0].sketchId, 'S1'); assert.equal(definition.hatches.length, 0); assert.equal(definition.referenceImages.length, 0);
});
test('modern annotation ownership is checked before normalization', () => {
  const data = raw(); data.annotations = [{ id: 'A1', type: 'text', sketchId: 'ROOT', text: 'note' }];
  assert.throws(() => decode(data), /invalid owning sketch/);
});
