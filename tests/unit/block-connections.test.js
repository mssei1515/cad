const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { GeometrySolver: {} } }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_ref.js', 'src/geometry/objects.js', 'src/persistence/block_connections.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
function fixture(rawConstraints = [], annotations = [], invalidDerived = false) {
  const point = { id: 'P1', sketchId: 'S2' }, projected = { id: 'BI1@P2', sketchId: 'S1' };
  const scope = { id: 'B1', name: 'Block', points: [point], lines: [], circles: [], arcs: [], splines: [], annotations, activeSketchId: 'S1', blockInstances: [{ definitionId: 'child' }] };
  const calls = [], metadata = new Map([['B1', { rawDefinition: { constraints: rawConstraints }, normalizeDefinitionSketchId: id => id || 'S1' }]]);
  const codec = sandbox.window.BlockConnectionsPersistence.create({
    createBlockProjectionBundle: () => ({ points: [projected], lines: [], circles: [], arcs: [] }),
    geometryInstanceBundlesForScope: () => invalidDerived ? [{ valid: false, instance: { id: 'GI' }, reason: 'broken' }] : [],
    elementSketchId: element => element.sketchId,
    deserializeConstraint(raw, points) { calls.push(raw.type); if (raw.throw) throw new Error('decode failure'); return points.has(raw.target) ? { point: points.get(raw.target) } : null; },
    constraintSketchId: constraint => constraint.point.sketchId,
    separateSharedSketchProjectionTargetPoints() { calls.push('separate'); },
    prepareLoadedParameterNamespace() { calls.push('parameters'); }, applicationText: (_ja, en) => en,
  });
  return { scope, point, projected, calls, restore: version => codec.restore([scope], metadata, { definitionById: () => ({}), sourceVersion: version, normalizeLoadedDimensionAppearance: value => value, normalizeLoadedExpression: value => value }) };
}
test('block connections resolve projected geometry, preserve metadata and count repairs', () => {
  const f = fixture([{ type: 'valid', target: 'BI1@P2', reference: true, referenceSketchId: 'S2' }, { type: 'unknown' }, { type: 'broken', throw: true }]);
  assert.equal(f.restore(22), 2); assert.equal(f.scope.constraints[0].point, f.projected); assert.equal(f.scope.constraints[0].referenceSketchId, 'S2');
  assert.deepEqual(f.calls, ['valid', 'unknown', 'broken', 'separate', 'parameters']);
});
test('removed constraints in old versions are discarded without repair count', () => {
  const f = fixture([{ type: 'pointOnLineMidpoint' }, { type: 'sketchProjection' }]); assert.equal(f.restore(15), 0);
  assert.deepEqual(f.calls, ['separate', 'parameters']);
});
test('modern midpoint and offset dimension decode failures abort loading', () => {
  assert.throws(() => fixture([{ type: 'pointOnLineMidpoint' }]).restore(16), /removed midpoint/);
  assert.throws(() => fixture([{ type: 'offsetChainDimension', throw: true }]).restore(14), /decode failure/);
  assert.equal(fixture([{ type: 'offsetChainDimension', throw: true }]).restore(13), 1);
});
test('legacy leader ownership follows target while text follows active sketch', () => {
  const leader = { type: 'leader', geometryRef: { kind: 'point', path: ['P1'] } }, text = { type: 'text' };
  const f = fixture([], [leader, text]); f.restore(10); assert.equal(leader.sketchId, 'S2'); assert.equal(text.sketchId, 'S1');
});
test('modern leaders must resolve in the same sketch', () => {
  const leader = { id: 'A1', type: 'leader', sketchId: 'S1', geometryRef: { kind: 'point', path: ['P1'] } };
  const f = fixture([], [leader]); assert.throws(() => f.restore(11), /same sketch/); assert.deepEqual(f.calls, []);
});
test('invalid derived bundle fails before decoding constraints', () => {
  const f = fixture([{ type: 'valid', target: 'P1' }], [], true); assert.throws(() => f.restore(22), /GI: broken/); assert.deepEqual(f.calls, []);
});
