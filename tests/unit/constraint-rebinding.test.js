const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { GeometrySolver: {}, GeometryRef: {} } }; vm.createContext(sandbox);
for (const file of ['src/geometry/objects.js', 'src/constraints/rebinding.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
const bundle = (points = []) => ({ points, lines: [], circles: [], arcs: [], splines: [] });
function fixture() {
  const local = { id: 'P1' }, nested = { id: 'B1:P1' }, free = { id: 'G1:P1' };
  const scope = { ...bundle([local]), blockInstances: [{ definitionId: 'nested' }, { definitionId: 'missing' }], constraints: [] };
  const nestedDefinition = { id: 'nested' }, seen = [];
  const rebinding = sandbox.window.ConstraintRebinding.create({
    catalog: { blockDefinitionById: id => id === 'nested' ? nestedDefinition : null },
    projections: { createBlockProjectionBundle(instance, definition) { assert.equal(definition, nestedDefinition); return bundle([nested]); } },
    geometryInstanceBundlesForScope(target, nestedBundles) { assert.equal(target, scope); assert.equal(nestedBundles.length, 1); return [bundle([free])]; },
    serializeConstraint(source) { if (source.serializeError) throw new Error('serialize'); return source; },
    decorateSerializedConstraint: data => data,
    deserializeConstraint(data, points, lines, primitives) {
      seen.push({ points, lines, primitives });
      if (data.decodeError) throw new Error('decode');
      const point = points.get(data.pointId); return point ? { point } : null;
    }, applicationText: (_ja, en) => en,
  });
  return { rebinding, scope, local, nested, free, seen };
}
test('definition rebinding resolves local, nested and free projection identities with metadata', () => {
  const f = fixture();
  f.scope.constraints = [f.local, f.nested, f.free].map(point => ({ pointId: point.id, sketchId: 's1', reference: 1, referenceSketchId: 's2' }));
  assert.equal(f.rebinding.rebuildDefinition(f.scope), 0);
  assert.deepEqual(Array.from(f.scope.constraints, item => item.point), [f.local, f.nested, f.free]);
  for (const constraint of f.scope.constraints) {
    assert.equal(constraint.sketchId, 's1'); assert.equal(constraint.reference, true); assert.equal(constraint.referenceSketchId, 's2');
  }
});
test('definition rebinding drops unresolved and undecodable constraints, retaining valid ones', () => {
  const f = fixture(); f.scope.constraints = [{ pointId: 'missing' }, { decodeError: true }, { pointId: 'P1' }];
  assert.equal(f.rebinding.rebuildDefinition(f.scope), 2);
  assert.equal(f.scope.constraints.length, 1); assert.equal(f.scope.constraints[0].reference, false); assert.equal(f.scope.constraints[0].referenceSketchId, null);
});
test('definition serialization errors leave the original constraint collection assigned', () => {
  const f = fixture(); const original = f.scope.constraints = [{ pointId: 'P1' }, { serializeError: true }];
  assert.throws(() => f.rebinding.rebuildDefinition(f.scope), /serialize/); assert.equal(f.scope.constraints, original);
});
test('document rebinding rejects unresolved constraints without assigning a partial collection', () => {
  const f = fixture(); const original = f.scope.constraints = [{ pointId: 'P1' }, { pointId: 'missing' }];
  assert.throws(() => f.rebinding.rebuildDocument(f.scope, []), /Document constraints could not be rebuilt/);
  assert.equal(f.scope.constraints, original);
});
test('document decode errors propagate and successful rebinding uses supplied projections', () => {
  const f = fixture(); const original = f.scope.constraints = [{ decodeError: true }];
  assert.throws(() => f.rebinding.rebuildDocument(f.scope, []), /decode/); assert.equal(f.scope.constraints, original);
  f.scope.constraints = [{ pointId: f.nested.id }]; f.rebinding.rebuildDocument(f.scope, [bundle([f.nested])]);
  assert.equal(f.scope.constraints[0].point, f.nested);
});
