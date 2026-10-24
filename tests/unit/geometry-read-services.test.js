const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const w = sandbox.window, { Point, Line } = w.GeometrySolver;
const point = (id, x = 0) => Object.assign(new Point(id, x, 0), { sketchId: 'S1' });
const scope = () => ({ points: [], lines: [], circles: [], arcs: [], splines: [], annotations: [], hatches: [], constraints: [],
  blockInstances: [], geometryInstances: [], sketches: [{ id: 'S1', kind: 'sketch' }, { id: 'S2', kind: 'sketch', parentSketchId: 'S1' }] });
function definition() {
  const a = point('P1', 1), b = point('P2', 4);
  return { ...scope(), id: 'B1', revision: 1, points: [a, b], lines: [Object.assign(new Line('L1', a, b), { sketchId: 'S1' })] };
}
function fixture({ withHatches = false } = {}) {
  const state = { ready: false, scope: scope(), sketches: [{ id: 'S1', kind: 'sketch', appearance: { color: '#123456' },
    dimensionAppearance: { prefix: 'initial' }, leaderAppearance: { color: '#112233' } }],
    definitions: [definition()], hidden: false, reads: 0, prepared: 0, profiles: 0, hatchReads: [], scale: 1, viewportReads: 0 };
  const document = { defaultAppearance: {}, defaultConstructionAppearance: {}, defaultDimensionAppearance: {},
    defaultLeaderAppearance: {}, defaultTerminatorAppearance: {}, get blockDefinitions() { assert.equal(state.ready, true); return state.definitions; } };
  const services = (withHatches ? w.GeometryReadServices.createWithHatches : w.GeometryReadServices.create)({ document,
    currentScope: () => { assert.equal(state.ready, true); state.reads++; return state.scope; },
    currentSketches: () => { assert.equal(state.ready, true); return state.sketches; },
    prepareBlocks: () => { state.prepared++; }, elementSketchId: item => item.sketchId,
    applicationText: (_ja, en) => en, activeSketchId: () => 'S1', isRootSketch: sketch => sketch.id === 'ROOT',
    sketchById: id => state.sketches.find(s => s.id === id), showHiddenElements: () => state.hidden,
    profileRead: work => { state.profiles++; return work(); },
    viewportScale: () => { assert.equal(state.ready, true); state.viewportReads++; if (state.viewportFailure) throw state.viewportFailure; return state.scale; },
    hatchGeometryQuery: { hatchPrimitivesFromElements: () => [], hatchPrimitivesForScope: () => [],
      resolvedHatchBoundary: (hatch, elements) => { state.hatchReads.push({ hatch, elements });
        return { ok: true, area: 4, loops: [{ role: 'outer', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }] }] }; } },
  });
  function scene() {
    const a = point('P1'), b = point('P2', 10), line = Object.assign(new Line('L1', a, b), { sketchId: 'S1' });
    state.scope.points = [a, b]; state.scope.lines = [line];
    state.scope.blockInstances = [{ id: 'BI1', definitionId: 'B1', sketchId: 'S1', x: 20, y: 30, rotation: 0 }];
    state.scope.geometryInstances = [{ id: 'SPI1', type: 'sketchProjection', sketchId: 'S2', sources: [{ kind: 'line', path: ['L1'] }] }];
    return line;
  }
  return { state, document, services, scene };
}

test('snapshot metadata keeps point class checks, explicit kinds and the live local PointUsage without reading expanded geometry', () => {
  const f = fixture(), usage = f.services.createPointUsage({ constraintReferencesPoint: () => false, editedFitPoints: () => [] });
  const metadata = f.services.createSnapshotMetadata({ pointUsage: usage });
  assert.equal(f.state.reads + f.state.prepared + f.state.profiles, 0); f.state.ready = true;
  const a = point('P1'), b = point('P2', 10), orphan = point('P3'); delete a.kind; b.kind = ''; delete orphan.kind;
  const line = Object.assign(new Line('L1', a, b), { sketchId: 'S1' }); f.state.scope.points = [a, b, orphan]; f.state.scope.lines = [line];
  assert.deepEqual({ ...metadata(a) }, { sketchId: 'S1', kind: 'endpoint' });
  assert.equal(metadata(b).kind, 'endpoint'); assert.equal(metadata(orphan).kind, 'explicit');
  const beforeReads = f.state.reads; a.kind = 'custom-kind'; assert.equal(metadata(a).kind, 'custom-kind'); assert.equal(f.state.reads, beforeReads);
  assert.deepEqual({ ...metadata(line) }, { sketchId: 'S1', kind: undefined });
  assert.equal(metadata({ id: 'P4', sketchId: 'S1', kind: 'endpoint' }).kind, undefined);
  delete a.kind; const replacement = scope(); f.state.scope = replacement; assert.equal(metadata(a).kind, 'explicit');
  replacement.lines.push(line); assert.equal(metadata(a).kind, 'endpoint');
  assert.equal(f.state.prepared + f.state.profiles, 0);
  const failure = new Error('Sketch unavailable'), bad = new Point('BAD', 0, 0); delete bad.kind;
  Object.defineProperty(bad, 'sketchId', { get() { throw failure; } });
  const count = f.state.reads; assert.throws(() => metadata(bad), error => error === failure); assert.equal(f.state.reads, count);
});

test('snapshot metadata preserves legacy JSON and the separate Block-definition point classification', () => {
  const f = fixture(), usage = f.services.createPointUsage({ constraintReferencesPoint: () => false, editedFitPoints: () => [] });
  const metadata = f.services.createSnapshotMetadata({ pointUsage: usage }); f.state.ready = true;
  const source = f.state.scope, a = point('P1'), b = point('P2', 10), orphan = point('P3');
  for (const p of [a, b, orphan]) delete p.kind;
  source.parameters = []; source.points = [a, b, orphan]; source.lines = [Object.assign(new Line('L1', a, b), { sketchId: 'S1' })];
  const local = definition(), localOrphan = point('LOCAL'); delete localOrphan.kind; local.points.push(localOrphan); source.blockDefinitions = [local];
  const legacy = item => ({ sketchId: item.sketchId, kind: item instanceof Point ? item.kind || (usage.isPointUsedByPrimitive(item) ? 'endpoint' : 'explicit') : undefined });
  const options = { version: 26, savedAt: 'fixed-time', documentName: 'Drawing', nextHatchIndex: 1 };
  const serialize = read => w.DocumentSnapshot.create({ geometryMetadata: read, constraintData: () => null }).serialize(source, options);
  const before = JSON.stringify(source), expected = serialize(legacy), actual = serialize(metadata);
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
  assert.deepEqual(Array.from(actual.points, p => p.kind), ['endpoint', 'endpoint', 'explicit']);
  assert.equal(actual.blockDefinitions[0].points.at(-1).kind, 'endpoint');
  f.state.scope = local; assert.equal(JSON.stringify(serialize(metadata)), JSON.stringify(serialize(legacy)));
  assert.equal(JSON.stringify(source), before);
});

test('read service composition defers document and scope access and retains the live Block registry', () => {
  const f = fixture(); assert.equal(f.state.reads, 0); assert.equal(f.state.prepared, 0); assert.equal(f.state.profiles, 0);
  assert.equal(Object.isFrozen(f.services), true); f.state.ready = true;
  assert.equal(f.services.catalog.blockDefinitionById('B1'), f.state.definitions[0]);
  const replacement = definition(); f.state.definitions = [replacement];
  assert.equal(f.services.catalog.blockDefinitionById('B1'), replacement); assert.equal(f.state.reads, 0);
});

test('Hatch assembly defers reads and resolves shared real geometry, derived fills and changed boundaries', () => {
  const f = fixture({ withHatches: true }), s = f.services;
  assert.equal(f.state.reads + f.state.prepared + f.state.profiles + f.state.viewportReads, 0);
  f.state.ready = true;
  function rectangle(width) {
    const points = [[0, 0], [width, 0], [width, 10], [0, 10]].map(([x, y], index) =>
      Object.assign(new Point('P' + index, x, y), { sketchId: 'S1' }));
    return { points, lines: points.map((a, index) => Object.assign(new Line('L' + index, a, points[(index + 1) % 4]), { sketchId: 'S1' })) };
  }
  Object.assign(f.state.scope, rectangle(10));
  const face = s.hatches.hatchFaceAt({ x: 5, y: 5 }); assert.equal(face.ok, true);
  const hatch = { id: 'H1', sketchId: 'S1', seed: { x: 5, y: 5 }, boundaryLoops: face.boundaryLoops, appearance: {} };
  f.state.scope.hatches = [hatch];
  const before = JSON.stringify(f.state.scope), resolved = s.hatches.resolvedHatchBoundary(hatch);
  assert.equal(resolved.area, 100); assert.equal(s.hatches.resolvedHatchBoundary(hatch), resolved);
  assert.equal(s.hatches.hatchBoundaryGeometryItems(hatch)[0], f.state.scope.lines[0]);
  assert.equal(JSON.stringify(f.state.scope), before);
  f.state.scope.geometryInstances.push({ id: 'SPI1', type: 'sketchProjection', sketchId: 'S2', sources: [{ kind: 'hatch', path: ['H1'] }] });
  const bundle = s.reads.geometryInstanceBundles()[0];
  assert.equal(bundle.valid, true); assert.equal(bundle.hatches[0].resolvedBoundary.area, 100);
  assert.equal(bundle.hatches[0].sourceElement, hatch);
  f.state.scope = { ...f.state.scope, ...rectangle(20), geometryInstances: [] };
  s.reads.clearReadCache(); s.projections.invalidateBlockProjectionCache();
  const next = s.hatches.resolvedHatchBoundary(hatch); assert.notEqual(next, resolved); assert.equal(next.area, 200);
  assert.equal(s.hatches.hatchBoundaryGeometryItems(hatch)[0], f.state.scope.lines[0]);
  f.state.sketches[0].appearance.visible = false; assert.equal(s.hatches.hatchFaceAt({ x: 5, y: 5 }).ok, false);
});

test('Hatch hit exclusion keeps live document width, late viewport reads, fallback and exception propagation', () => {
  const f = fixture({ withHatches: true }), hatches = f.services.hatches;
  f.state.ready = true; f.document.defaultAppearance.lineWidth = 4;
  const hatch = { boundaryLoops: [] }, resolved = { ok: true, loops: [{ role: 'outer', points:
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }] };
  assert.equal(hatches.hatchContainsSelectablePoint(hatch, resolved, { x: 2.5, y: 5 }), false);
  f.state.scale = 2; assert.equal(hatches.hatchContainsSelectablePoint(hatch, resolved, { x: 2.5, y: 5 }), true);
  assert.equal(f.state.viewportReads, 2);
  const fallback = Math.max(0.5, w.Appearance.DEFAULT_APPEARANCE.lineWidth / 2) + 1;
  for (const value of [0, 'bad', undefined]) { f.document.defaultAppearance.lineWidth = value;
    assert.equal(hatches.hatchBoundaryHitExclusionScreenPx(hatch), fallback); }
  const failure = new Error('viewport unavailable'); f.state.viewportFailure = failure;
  assert.throws(() => hatches.hatchContainsSelectablePoint(hatch, resolved, { x: 5, y: 5 }), error => error === failure);
});

test('real Block and derived projections share expanded reads and preserve source and reference identity', () => {
  const f = fixture(); f.state.ready = true; const local = f.scene(), { reads } = f.services;
  reads.withGeometryReadCache(() => {
    const lines = reads.allGeometryLines();
    assert.deepEqual(Array.from(lines, line => line.id), ['L1', 'BI1@L1', 'SPI1@L1']);
    assert.equal(lines[0], local); assert.equal(lines[1].localElement, f.state.definitions[0].lines[0]);
    assert.equal(lines[2].sourceElement, local); assert.equal(lines[1].p1.x, 21);
    assert.equal(reads.resolveGeometryRef({ kind: 'line', path: ['BI1', 'L1'] }), lines[1]);
    const profiles = f.state.profiles;
    reads.withGeometryReadCache(() => assert.equal(reads.allGeometryLines(), lines));
    assert.equal(f.state.profiles, profiles); assert.equal(f.state.prepared, 1);
  });
});

test('appearance reads use the same read window and retain live hidden, dimension and annotation Sketch sources', () => {
  const f = fixture(); f.state.ready = true; const line = f.scene(), s = f.services;
  s.reads.withGeometryReadCache(() => {
    const first = s.geometryAppearance.effectiveAppearanceForElement(line);
    assert.equal(first.color, '#123456'); assert.equal(s.geometryAppearance.effectiveAppearanceForElement(line), first);
    assert.equal(s.reads.readAppearance(line), first);
  });
  f.state.sketches = [{ id: 'S1', kind: 'sketch', appearance: { color: '#654321', visible: false },
    dimensionAppearance: { prefix: 'replacement' }, leaderAppearance: { color: '#998877' } }];
  assert.equal(s.geometryAppearance.effectiveAppearanceForElement(line).color, '#654321');
  assert.equal(s.geometryAppearance.isVisibleSketchElement(line), false); f.state.hidden = true;
  assert.equal(s.geometryAppearance.isVisibleSketchElement(line), true);
  assert.equal(s.dimensionAppearance.dimensionDisplayState({}).prefix, 'replacement');
  assert.equal(s.annotationAppearance.effectiveAnnotationStyle({ type: 'leader', sketchId: 'S1', appearanceInheritance: true, style: {} }).color, '#998877');
  assert.equal(f.state.scope.sketches[0].dimensionAppearance, undefined);
});

test('existing cache invalidation follows replacement scope and definitions even when all IDs are reused', () => {
  const f = fixture(); f.state.ready = true; const original = f.scene(), s = f.services;
  s.reads.withGeometryReadCache(() => {
    const oldLines = s.reads.allGeometryLines(); s.geometryAppearance.effectiveAppearanceForElement(original);
    f.state.scope = scope(); f.state.definitions = [definition()]; f.state.definitions[0].points[0].x = 7;
    const replacement = f.scene(); replacement.p1.x = 50;
    s.reads.clearReadCache(); s.projections.invalidateBlockProjectionCache();
    const next = s.reads.allGeometryLines(); assert.notEqual(next, oldLines); assert.equal(next[0], replacement);
    assert.equal(s.reads.readAppearance(original), undefined); assert.equal(next[1].p1.x, 27);
    assert.equal(next[2].sourceElement, replacement); assert.equal(next[2].p1.x, 50);
  });
});

test('derived Hatch expansion delegates boundary resolution through the supplied Hatch query', () => {
  const f = fixture(); f.state.ready = true;
  const hatch = { id: 'H1', sketchId: 'S1', seed: { x: 1, y: 1 }, boundaryLoops: [], appearance: {} };
  f.state.scope.hatches.push(hatch);
  f.state.scope.geometryInstances.push({ id: 'SPI1', type: 'sketchProjection', sketchId: 'S2', sources: [{ kind: 'hatch', path: ['H1'] }] });
  const bundle = f.services.reads.geometryInstanceBundles()[0];
  assert.equal(bundle.valid, true); assert.equal(bundle.hatches[0].resolvedBoundary.area, 4);
  assert.equal(f.state.hatchReads.at(-1).hatch, hatch); assert.equal(Array.isArray(f.state.hatchReads.at(-1).elements), true);
});

test('point usage shares expanded reads and their cache while keeping local scope and replacement identity distinct', () => {
  const f = fixture();
  const usage = f.services.createPointUsage({ constraintReferencesPoint: () => false,
    editedFitPoints: () => { assert.equal(f.state.ready, true); return undefined; } });
  assert.equal(f.state.reads + f.state.prepared + f.state.profiles, 0); f.state.ready = true;
  const local = f.scene(); let projectedPoint;
  f.services.reads.withGeometryReadCache(() => {
    const lines = f.services.reads.allGeometryLines(); projectedPoint = lines[1].p1;
    const profiles = f.state.profiles;
    assert.equal(usage.isAnyLineEndpoint(projectedPoint), true);
    assert.equal(usage.isPointUsedByLine(projectedPoint), false);
    assert.equal(usage.isPointUsedByLine(local.p1), true); assert.equal(f.state.profiles, profiles);
  });
  f.state.scope = scope(); f.services.reads.clearReadCache(); f.services.projections.invalidateBlockProjectionCache();
  const replacement = f.scene();
  assert.equal(usage.isPointUsedByLine(local.p1), false); assert.equal(usage.isPointUsedByLine(replacement.p1), true);
  assert.equal(usage.isAnyLineEndpoint(projectedPoint), false);
});

test('point usage keeps spline edit membership live and preserves disabled-constraint and error boundaries', () => {
  const f = fixture(); let edited, editFailure, referenceCalls = 0;
  const usage = f.services.createPointUsage({
    constraintReferencesPoint: (constraint, point) => { referenceCalls++; return constraint.point === point; },
    editedFitPoints: () => { assert.equal(f.state.ready, true); if (editFailure) throw editFailure; return edited; },
  });
  f.state.ready = true;
  const fit = point('FIT'), orphan = point('ORPHAN'); fit.kind = orphan.kind = 'endpoint';
  f.state.scope.splines = [{ fitPoints: [fit] }];
  assert.equal(usage.isSelectableEndpointPoint(fit), false); edited = [fit];
  assert.equal(usage.isSelectableEndpointPoint(fit), true); edited = [];
  assert.equal(usage.isSelectableEndpointPoint(fit), false);
  const constraint = { point: orphan, enabled: false }; f.state.scope.constraints = [constraint];
  assert.equal(usage.isReferencePoint(orphan), false); assert.equal(referenceCalls, 0);
  constraint.enabled = true; assert.equal(usage.isReferencePoint(orphan), true); assert.equal(referenceCalls, 1);
  const before = JSON.stringify(f.state.scope), failure = new Error('edit points unavailable'); editFailure = failure;
  assert.throws(() => usage.isSelectableEndpointPoint(fit), error => error === failure);
  assert.equal(JSON.stringify(f.state.scope), before);
});
