const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
const sandbox = { window: { Appearance: { normalizeDimensionAppearance: value => ({ ...value, normalized: true }) } } }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/persistence/dimensions.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [];
  const codec = sandbox.window.DimensionPersistence.create({
    migrateAngleDimensionLabelPlacement: (target, dimension) => { calls.push('migrate'); dimension.angleLabelOffsetR = 4; dimension.angleLabelOffsetT = 6; },
    dimensionAnchor: (target, dimension) => { calls.push('anchor'); return { x: 12, y: 15 }; },
    storedDimensionAxis: () => { calls.push('axis'); return 'horizontal'; },
  }); return { calls, serialize: codec.serialize };
}
test('missing dimensions and optional values retain compatible null/default omission semantics', () => {
  const f = fixture(); assert.equal(f.serialize(null), null);
  const result = f.serialize({ x: '3', y: '4', offsetU: NaN, offsetN: Infinity, labelOffsetU: NaN, labelX: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { x: 3, y: 4, offsetU: null, offsetN: null, labelOffsetU: 0, axis: null, display: null });
  assert.deepEqual(f.calls, []);
});
test('placement adapters run before serialization and display data is normalized separately', () => {
  const f = fixture(); const dimension = { offsetU: 0, offsetN: 2, labelOffsetU: 3, labelX: 4, labelY: 5, display: { color: '#123456' } };
  const result = f.serialize(dimension, { kind: 'distance' });
  assert.deepEqual(f.calls, ['anchor', 'axis']); assert.equal(result.x, 12); assert.equal(result.axis, 'horizontal');
  assert.equal(result.offsetU, 0); assert.equal(result.labelY, 5); assert.equal(result.display.normalized, true);
  assert.notEqual(result.display, dimension.display); assert.equal('angleRadius' in result, false);
});
test('angle migration precedes anchor calculation and emits versioned radial/tangential placement', () => {
  const f = fixture(); const result = f.serialize({ angleStartFlip: 0, angleEndFlip: 1.2, angleRadius: 9 }, { kind: 'angle' });
  assert.deepEqual(f.calls, ['migrate', 'anchor', 'axis']);
  assert.equal(result.angleStartFlip, 0); assert.equal(result.angleEndFlip, null); assert.equal(result.angleRadius, 9);
  assert.equal(result.angleLabelOffsetR, 4); assert.equal(result.angleLabelOffsetT, 6); assert.equal(result.angleLabelPlacementVersion, 2);
});
