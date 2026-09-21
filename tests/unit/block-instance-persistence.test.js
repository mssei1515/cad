const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/document/appearance.js', 'src/document/drawing_order.js', 'src/document/sketch_hierarchy.js', 'src/document/block_catalog.js', 'src/persistence/block_instances.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
const definition = id => ({ id, name: id, sketches: [{ id: 'S1', kind: 'sketch' }, { id: 'S2', kind: 'sketch' }], lines: [{ sketchId: 'S2' }], circles: [], arcs: [], splines: [], hatches: [], annotations: [], blockInstances: [] });
function fixture(rawInstances = []) {
  const parent = definition('parent'), child = definition('child');
  const metadata = new Map([[parent.id, { rawDefinition: { blockInstances: rawInstances, geometryInstances: [{ id: 'GI' }] }, normalizeDefinitionSketchId: value => value || 'S1' }], [child.id, { rawDefinition: {}, normalizeDefinitionSketchId: () => 'S2' }]]);
  const codec = sandbox.window.BlockInstancePersistence.create({ definitions: [parent, child], metadata,
    normalizeGeometryInstance: (raw, normalize, index) => ({ id: raw.id, sketchId: normalize(raw.sketchId), index }) });
  return { codec, parent, child };
}
test('nested instance fallback enables all drawable sketches and uses filtered index ids', () => {
  const f = fixture([{ definitionId: 'missing' }, { definitionId: 'child', enabledSketchIds: ['invalid'], x: '12' }]);
  f.codec.connectDefinitions(); const instance = f.parent.blockInstances[0];
  assert.equal(instance.id, 'BI1'); assert.equal(instance.x, 12); assert.equal(instance.enabledSketchIds.join(','), 'S1,S2');
  assert.equal(f.parent.geometryInstances[0].sketchId, 'S1'); assert.equal(f.codec.definitionById('child'), f.child);
});
test('document fallback enables only sketches with geometry while omitted list enables all', () => {
  const f = fixture(); f.codec.connectDefinitions();
  const instances = f.codec.decodeDocument([{ definitionId: 'child', enabledSketchIds: [] }, { definitionId: 'child' }], () => 'S9');
  assert.equal(instances[0].enabledSketchIds.join(','), 'S2'); assert.equal(instances[1].enabledSketchIds.join(','), 'S1,S2');
  assert.equal(instances[0].sketchId, 'S9');
});
test('document rejects owned child definitions and filters missing definitions', () => {
  const f = fixture(); f.child.parentDefinitionId = 'parent';
  assert.throws(() => f.codec.decodeDocument([{ definitionId: 'child' }], String), /親ブロック内でのみ/);
  assert.equal(f.codec.decodeDocument([{ definitionId: 'missing' }], String).length, 0);
});
test('geometry fallback includes nested placement sketch and deduplicates enabled ids', () => {
  const f = fixture([{ definitionId: 'child', sketchId: 'S1' }]); f.parent.lines = []; f.codec.connectDefinitions();
  const instances = f.codec.decodeDocument([{ definitionId: 'parent', enabledSketchIds: [] }, { definitionId: 'child', enabledSketchIds: ['S2', 'S2', 'invalid'] }], String);
  assert.equal(instances[0].enabledSketchIds.join(','), 'S1'); assert.equal(instances[1].enabledSketchIds.join(','), 'S2');
});
