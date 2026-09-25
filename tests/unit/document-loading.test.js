const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const sandbox = { window: {}, structuredClone };
vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}

function fixture(overrides = {}) {
  const calls = [];
  const loader = sandbox.window.DocumentLoading.create({
    defaultUnits: { length: 'mm' }, applicationText: (_ja, en) => en,
    geometryInstancePersistence: { migrateLegacy: data => { data.migrated = true; } },
    serializedGeometryInstanceListError: () => null,
    normalizeGeometryInstance: value => value,
    blockDefinitionPersistence: { decode: () => ({ definitions: [], metadata: new Map() }) },
    blockConnectionsPersistence: { restore: () => 2 },
    documentGeometryPersistence: { decode: data => {
      calls.push('decode');
      return {
        retainedPoints: data.points, lines: data.lines, circles: [], arcs: [], splines: [], constraints: data.constraints,
        loadedAnnotations: [], loadedHatches: [{ id: 'H8' }], loadedReferenceImages: [],
        loadedRootNamespace: { parameters: [{ name: 'Width', expression: '10' }], nextDimensionParameterIndex: 7 },
      };
    } },
    invalidateProjection: () => calls.push('invalidate'),
    normalizeArcSweeps: () => calls.push('arcs'),
    ...overrides,
  });
  return { loader, calls, data: { points: [{ id: 'P1', x: 2, y: 3 }], lines: [], constraints: [], documentName: 'Saved', nextHatchIndex: 20 } };
}

test('decoding isolates migrations from input and does not install or repair active geometry', () => {
  const { loader, calls, data } = fixture();
  const before = JSON.stringify(data);
  const candidate = loader.decode(data, { documentNameOverride: 'Override' });
  assert.equal(candidate.documentName, 'Override');
  assert.equal(candidate.units.length, 'mm');
  assert.equal(candidate.nextHatchIndex, 20);
  assert.equal(candidate.repairedBlockConstraintCount, 2);
  assert.equal(candidate.points[0].x, 2);
  assert.notEqual(candidate.points[0], data.points[0]);
  assert.equal(JSON.stringify(data), before);
  assert.deepEqual(calls, ['decode']);
});

test('installation retains scope arrays and constraint object identity', () => {
  const { loader, calls, data } = fixture();
  const candidate = loader.decode(data);
  const constraint = { point: candidate.points[0] };
  candidate.constraints.push(constraint);
  const scope = { sketches: [{ id: 'old' }], points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [] };
  const originalPoints = scope.points;
  const originalSketches = scope.sketches;
  const document = {};
  loader.install(candidate, document, scope);
  assert.equal(scope.points, originalPoints);
  assert.equal(scope.sketches, originalSketches);
  assert.equal(scope.sketches.length, candidate.sketches.length);
  assert.equal(scope.constraints[0], constraint);
  assert.equal(scope.constraints[0].point, scope.points[0]);
  assert.equal(document.blockDefinitions, candidate.blockDefinitions);
  assert.equal(scope.parameters, candidate.parameters);
  assert.equal(scope.nextDimensionParameterIndex, 7);
  assert.deepEqual(calls, ['decode', 'invalidate', 'arcs']);
});

test('invalid current document units fail before geometry decode or installation', () => {
  const { loader, calls, data } = fixture();
  assert.throws(() => loader.decode({ ...data, version: 20, units: { length: 'inch' } }), /Invalid document length unit/);
  assert.deepEqual(calls, []);
  assert.throws(() => loader.decode(null), /保存データ/);
});

test('projection invalidation and arc normalization observe the established installation stages', () => {
  const scope = { sketches: [], points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [], parameters: [] };
  const oldParameters = scope.parameters;
  let candidate;
  const { loader, data } = fixture({
    invalidateProjection: () => {
      assert.equal(scope.geometryInstances, candidate.geometryInstances);
      assert.equal(scope.points.length, 0);
    },
    normalizeArcSweeps: arcs => {
      assert.equal(arcs, scope.arcs);
      assert.equal(scope.points[0], candidate.points[0]);
      assert.equal(scope.constraints[0], candidate.constraints[0]);
      assert.equal(scope.parameters, oldParameters);
    },
  });
  candidate = loader.decode(data);
  candidate.constraints.push({ point: candidate.points[0] });
  loader.install(candidate, {}, scope);
  assert.equal(scope.parameters, candidate.parameters);
});

test('document naming uses saved name before fallback and fallback for unnamed legacy data', () => {
  const { loader, data } = fixture();
  assert.equal(loader.decode(data, { documentNameFallback: 'Fallback' }).documentName, 'Saved');
  delete data.documentName;
  assert.equal(loader.decode(data, { documentNameFallback: 'Fallback' }).documentName, 'Fallback');
});
