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

function configuredFixture() {
  const w = sandbox.window, calls = [], state = { ready: false };
  const elementSketchId = item => item.sketchId, applicationText = (_ja, en) => en;
  const instances = w.InstanceProjection.create({ elementSketchId, applicationText, resolveHatch: () => ({ ok: false }) });
  const projections = w.BlockProjection.create({ blockCatalog: w.BlockCatalog.create({ definitions: () => [] }),
    geometryInstanceBundlesForScope: instances.geometryInstanceBundlesForScope, emptyGeometryInstanceBundle: instances.emptyGeometryInstanceBundle,
    hatchPrimitivesFromElements: () => [], hatchPrimitivesForScope: () => [] });
  const services = w.DocumentLoading.createWithCodecs({ applicationText, defaultUnits: w.DocumentState.DEFAULT_DOCUMENT_UNITS,
    createBlockProjectionBundle: (...args) => { assert.equal(state.ready, true); return projections.createBlockProjectionBundle(...args); },
    geometryInstanceBundlesForScope: (...args) => { assert.equal(state.ready, true); return instances.geometryInstanceBundlesForScope(...args); },
    elementSketchId, constraintSketchId: item => item.sketchId,
    deserializeConstraint: (raw, points) => raw.type === 'distance' ? new w.GeometrySolver.DistanceConstraint(points.get(raw.p1), points.get(raw.p2), raw.target) : null,
    separateSharedSketchProjectionTargetPoints: () => calls.push('separate'), prepareLoadedParameterNamespace: (_namespace, _version, label) => calls.push(label),
    isPointUsedByLine: (point, lines) => lines.some(line => line.p1 === point || line.p2 === point),
    isPointUsedByCircle: (point, circles) => circles.some(circle => circle.center === point), isPointUsedByArc: () => false,
    constraintReferencesPoint: (constraint, point) => constraint.p1 === point || constraint.p2 === point,
    invalidateProjection: () => calls.push('invalidate'), normalizeArcSweeps: () => calls.push('arcs') });
  assert.deepEqual(calls, []); state.ready = true;
  function namespace() {
    return { points: [{ id: 'P1', x: 0, y: 0, sketchId: 'S1' }, { id: 'P2', x: 100, y: 0, sketchId: 'S1' }],
      lines: [{ id: 'L1', p1: 'P1', p2: 'P2', sketchId: 'S1' }], circles: [], arcs: [], splines: [],
      constraints: [{ type: 'distance', p1: 'P1', p2: 'P2', target: 100, sketchId: 'S1' }],
      annotations: [], hatches: [], nextHatchIndex: 1, referenceImages: [], geometryInstances: [], blockInstances: [],
      parameters: [], nextDimensionParameterIndex: 1, sketches: w.DocumentState.create().sketches, activeSketchId: 'S1' };
  }
  const data = { ...namespace(), version: 25, units: { length: 'mm' }, blockDefinitions: [{ ...namespace(), id: 'B1', name: 'Block' }] };
  return { w, services, calls, data };
}

test('configured loader connects actual root and Block codecs without mutating input or losing constraint references', () => {
  const f = configuredFixture(); f.data.blockInstances = [{ id: 'BI1', definitionId: 'B1', sketchId: 'S1', x: 200, y: 20 }];
  const before = JSON.stringify(f.data), candidate = f.services.loading.decode(f.data);
  assert.equal(JSON.stringify(f.data), before);
  assert.equal(candidate.lines[0].p1, candidate.points[0]); assert.equal(candidate.constraints[0].p2, candidate.points[1]);
  const definition = candidate.blockDefinitions[0];
  assert.equal(definition.lines[0].p1, definition.points[0]); assert.equal(definition.constraints[0].p2, definition.points[1]);
  assert.notEqual(definition.points[0], candidate.points[0]); assert.equal(candidate.blockInstances[0].definitionId, definition.id);
  assert.deepEqual(f.calls, ['separate', 'Block Block', 'separate', 'Document']);
  const document = f.w.DocumentState.create(), points = document.points, sketches = document.sketches;
  f.w.DocumentState.clearContent(document); f.w.DocumentState.resetDefaults(document); f.services.loading.install(candidate, document, document);
  assert.equal(document.points, points); assert.equal(document.sketches, sketches); assert.equal(document.constraints[0], candidate.constraints[0]);
  assert.equal(document.constraints[0].p1, document.points[0]); assert.equal(document.blockDefinitions, candidate.blockDefinitions);
  assert.deepEqual(f.calls.slice(-2), ['invalidate', 'arcs']);
});

test('configured shared Instance validation rejects root and Block candidates before DocumentApplication resets live state', () => {
  for (const kind of ['root', 'block']) {
    const f = configuredFixture(), invalid = { id: 'FI1', type: 'free' };
    (kind === 'root' ? f.data : f.data.blockDefinitions[0]).geometryInstances = [invalid];
    const document = f.w.DocumentState.create(), old = new f.w.GeometrySolver.Point('old', 12, 34); document.points.push(old);
    let resets = 0;
    const application = f.w.DocumentApplication.create({ documentLoading: f.services.loading, document, model: document,
      resetEditingState: () => { resets++; }, sketchTreeView: { capture: () => ({}), restore: () => assert.fail('invalid candidate must not restore tree') } });
    const before = JSON.stringify(f.data);
    assert.match(f.services.geometryInstances.listError([invalid]), /unsupported type free/);
    assert.throws(() => application.load(f.data, { preserveSketchTreeState: true }), /unsupported type free/);
    assert.equal(resets, 0); assert.equal(document.points[0], old); assert.equal(JSON.stringify(f.data), before);
    assert.deepEqual(f.calls, []);
  }
});

test('configured loader normalizes root and Block patterns through the same exposed Instance codec', () => {
  const f = configuredFixture(), ref = { kind: 'line', path: ['L1'] };
  const pattern = f.w.PatternInstanceModel.createDraft({ id: 'PI1', type: 'pattern', sketchId: 'S1', sources: [ref] });
  pattern.placement.direction = ref; pattern.placement.spacing = 10;
  f.data.geometryInstances = [pattern]; f.data.blockDefinitions[0].geometryInstances = [structuredClone(pattern)];
  assert.equal(f.services.geometryInstances.listError([pattern]), '');
  const candidate = f.services.loading.decode(f.data), expected = f.services.geometryInstances.normalize(pattern, () => 'S1');
  for (const namespace of [candidate, candidate.blockDefinitions[0]]) {
    assert.equal(namespace.geometryInstances[0].count, expected.count);
    assert.equal(namespace.geometryInstances[0].placement.spacing, expected.placement.spacing);
    assert.equal(namespace.geometryInstances[0].sources[0].path[0], 'L1');
  }
});

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
