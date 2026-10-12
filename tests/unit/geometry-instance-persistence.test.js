const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_ref.js', 'src/document/appearance.js', 'src/document/drawing_order.js', 'src/persistence/geometry_instances.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
const codec = sandbox.window.GeometryInstancePersistence.create({ applicationText: (_ja, en) => en });
const ref = { kind: 'line', path: ['L1'] };
const projection = () => ({ id: 'SPI1', type: 'sketchProjection', sources: [ref] });
test('normalization uses explicit sketch resolver and creates typed instance data', () => {
  const instance = codec.normalize({ type: 'pattern', sources: [ref, {}], direction: 'L2', spacing: '5', copies: 3.9, reversed: 1 }, () => 'S2', 2);
  assert.equal(instance.id, 'PI3'); assert.equal(instance.sketchId, 'S2'); assert.equal(instance.sources.length, 1);
  assert.equal(instance.direction.path[0], 'L2'); assert.equal(instance.spacing, 5); assert.equal(instance.copies, 3); assert.equal(instance.reversed, true);
});
test('free instance validation requires finite numeric placement and boolean mirrors', () => {
  const data = { ...projection(), type: 'free', x: 0, y: 0, rotation: 0, origin: { x: 0, y: 0 }, mirrorX: false, mirrorY: false };
  assert.equal(codec.listError([data]), '');
  assert.match(codec.listError([{ ...data, x: '0' }]), /invalid placement/);
  assert.match(codec.listError([{ ...data, mirrorX: 0 }]), /invalid placement/);
});
test('instance lists reject duplicate ids, invalid sources, axes and pattern limits', () => {
  assert.match(codec.listError([projection(), projection()]), /duplicate ID/);
  assert.match(codec.listError([{ ...projection(), sources: [] }]), /invalid source/);
  assert.match(codec.listError([{ ...projection(), type: 'mirror', axis: { kind: 'point', path: ['P1'] } }]), /mirror axis/);
  assert.match(codec.listError([{ ...projection(), type: 'pattern', direction: ref, spacing: 1, copies: 1001 }]), /pattern settings/);
});
test('legacy projection migration removes outputs but keeps points still used by ordinary geometry', () => {
  const namespace = { points: [{ id: 'P1' }, { id: 'P2' }, { id: 'P3' }], lines: [{ id: 'L1', p1: 'P1', p2: 'P2', sketchId: 'S2' }, { id: 'L2', p1: 'P1', p2: 'P3' }], constraints: [{ type: 'sketchProjection', kind: 'line', target: 'L1', source: 'B1@L9' }, { type: 'horizontal', line: 'L2' }] };
  assert.equal(codec.migrateLegacy(namespace, 20), namespace);
  assert.equal(namespace.geometryInstances[0].id, 'SPI1'); assert.equal(namespace.geometryInstances[0].sources[0].path.join('@'), 'B1@L9');
  assert.equal(namespace.geometryInstances[0].legacyOutput.pointIds.join(','), 'P1,P2');
  assert.equal(namespace.lines.length, 1); assert.equal(namespace.lines[0].id, 'L2');
  assert.equal(namespace.points.map(point => point.id).join(','), 'P1,P3'); assert.equal(namespace.constraints.length, 1);
});
test('migration only applies to versions 19 and 20 and initializes their empty instance list', () => {
  for (const version of [18, 21, 22]) { const data = {}; codec.migrateLegacy(data, version); assert.equal(data.geometryInstances, undefined); }
  const data = {}; codec.migrateLegacy(data, 19); assert.equal(data.geometryInstances.length, 0);
});
