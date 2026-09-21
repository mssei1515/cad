const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_ref.js', 'src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/geometry/hatch_region.js', 'src/solver/constraint_solver.js', 'src/geometry/objects.js', 'src/document/appearance.js', 'src/document/drawing_order.js', 'src/document/sketch_hierarchy.js', 'src/document/annotations.js', 'src/document/hatches.js', 'src/document/reference_images.js', 'src/persistence/geometry.js', 'src/persistence/document_geometry.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
function fixture() {
  const data = { points: [{ id: 'P1', x: 0, y: 0, kind: 'endpoint' }, { id: 'P2', x: 1, y: 0, kind: 'endpoint' }, { id: 'P3', x: 2, y: 0, kind: 'endpoint' }], lines: [{ id: 'L1', p1: 'P1', p2: 'P2' }], circles: [], arcs: [], splines: [], constraints: [], hatches: [], nextHatchIndex: 1, referenceImages: [], parameters: [] };
  const calls = [];
  const codec = sandbox.window.DocumentGeometryPersistence.create({
    createBlockProjectionBundle: () => assert.fail('no blocks'), geometryInstanceBundlesForScope: () => [], elementSketchId: item => item.sketchId,
    deserializeConstraint: (raw, points) => raw.target ? { point: points.get(raw.target) } : null,
    constraintSketchId: () => 'S1', separateSharedSketchProjectionTargetPoints: () => calls.push('separate'),
    prepareLoadedParameterNamespace: () => calls.push('parameters'),
    isPointUsedByLine: (point, lines) => lines.some(line => line.p1 === point || line.p2 === point),
    isPointUsedByCircle: () => false, isPointUsedByArc: () => false,
    constraintReferencesPoint: (constraint, point) => constraint.point === point, applicationText: (_ja, en) => en,
  });
  const decode = (version = 22) => codec.decode(data, { sourceVersion: version, normalizeSketchId: () => 'S1', sketches: [{ id: 'S1' }], sketchIds: new Set(['S1']), definitions: [], definitionById: () => null, blockInstances: [], geometryInstances: [], normalizeLoadedDimensionAppearance: value => value, normalizeLoadedExpression: value => String(value ?? '') });
  return { data, calls, decode };
}
test('document candidate excludes unused endpoints but preserves constrained ones', () => {
  const f = fixture(); let result = f.decode(); assert.equal(result.retainedPoints.length, 2);
  f.data.constraints = [{ target: 'P3' }]; result = f.decode(); assert.equal(result.retainedPoints.length, 3);
  assert.equal(result.constraints[0].point, result.retainedPoints[2]); assert.deepEqual(f.calls, ['separate', 'parameters', 'separate', 'parameters']);
});
test('unrestorable document constraints abort instead of being silently repaired', () => {
  const f = fixture(); f.data.constraints = [{ type: 'unknown' }]; assert.throws(f.decode, /未対応の制約/); assert.deepEqual(f.calls, []);
});
test('current annotations reject invalid owners while legacy annotations use active sketch', () => {
  const f = fixture(); f.data.annotations = [{ id: 'A1', type: 'text', text: 'note', x: 0, y: 0, sketchId: 'ROOT' }];
  assert.throws(f.decode, /invalid owning sketch/); const result = f.decode(10); assert.equal(result.loadedAnnotations[0].sketchId, 'S1');
});
