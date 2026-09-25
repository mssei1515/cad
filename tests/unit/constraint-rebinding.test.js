const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { GeometrySolver: {}, GeometryRef: {}, SketchHierarchy: { DEFAULT_SKETCH_ID: "S1" } } }; vm.createContext(sandbox);
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


test('Block constraint copies rebase dimension and fixed coordinates and preserve reference metadata only on request', () => {
  const point = { id: 'P1' }, points = new Map([['P1', point]]), lines = new Map(), primitives = new Map();
  const service = sandbox.window.ConstraintRebinding.create({
    serializeConstraint: source => ({ ...source }), decorateSerializedConstraint: data => data,
    deserializeConstraint(data, p, l, g) { assert.equal(p, points); assert.equal(l, lines); assert.equal(g, primitives); return { ...data, point: p.get(data.pointId) }; },
  });
  const source = { pointId: 'P1', type: 'lineFixed', p1x: 12, p2x: 14, p1y: 23, p2y: 25,
    dimension: { x: '13', labelX: 14, y: 25, labelY: '26', text: 'unchanged' }, reference: true, referenceSketchId: 'S9' };
  const before = JSON.stringify(source);
  const copy = service.cloneForBlock(source, points, lines, primitives, { x: 10, y: 20 });
  assert.equal(copy.point, point); assert.equal(copy.sketchId, 'S1');
  assert.deepEqual([copy.p1x, copy.p2x, copy.p1y, copy.p2y], [2, 4, 3, 5]);
  assert.deepEqual([copy.dimension.x, copy.dimension.labelX, copy.dimension.y, copy.dimension.labelY], [3, 4, 5, 6]);
  assert.equal(copy.dimension.text, 'unchanged'); assert.equal(copy.reference, false); assert.equal(copy.referenceSketchId, null);
  assert.equal(JSON.stringify(source), before);
  source.sketchId = 'S3';
  const preserved = service.cloneForBlock(source, points, lines, primitives, undefined, true);
  assert.equal(preserved.reference, true); assert.equal(preserved.referenceSketchId, 'S9'); assert.equal(preserved.sketchId, 'S3');
  for (const type of ['geometryFixed', 'arcEndpointFixed']) {
    const fixed = service.cloneForBlock({ type, x: 12, y: 23 }, points, lines, primitives, { x: 10, y: 20 });
    assert.deepEqual([fixed.x, fixed.y], [2, 3]);
  }
});

test('Block constraint copy rejects unsupported serialization and unresolved references', () => {
  const options = { serializeConstraint: value => value, decorateSerializedConstraint: value => value, deserializeConstraint: () => null };
  const service = sandbox.window.ConstraintRebinding.create(options);
  assert.throws(() => service.cloneForBlock(null), /未対応/);
  assert.throws(() => service.cloneForBlock({}), /複製できません/);
});
