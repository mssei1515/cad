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
function fixture() {
  const state = { ready: false, scope: scope(), sketches: [{ id: 'S1', kind: 'sketch', appearance: { color: '#123456' },
    dimensionAppearance: { prefix: 'initial' }, leaderAppearance: { color: '#112233' } }],
    definitions: [definition()], hidden: false, reads: 0, prepared: 0, profiles: 0, hatchReads: [] };
  const document = { defaultAppearance: {}, defaultConstructionAppearance: {}, defaultDimensionAppearance: {},
    defaultLeaderAppearance: {}, defaultTerminatorAppearance: {}, get blockDefinitions() { assert.equal(state.ready, true); return state.definitions; } };
  const services = w.GeometryReadServices.create({ document,
    currentScope: () => { assert.equal(state.ready, true); state.reads++; return state.scope; },
    currentSketches: () => { assert.equal(state.ready, true); return state.sketches; },
    prepareBlocks: () => { state.prepared++; }, elementSketchId: item => item.sketchId,
    applicationText: (_ja, en) => en, activeSketchId: () => 'S1', isRootSketch: sketch => sketch.id === 'ROOT',
    sketchById: id => state.sketches.find(s => s.id === id), showHiddenElements: () => state.hidden,
    profileRead: work => { state.profiles++; return work(); },
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

test('read service composition defers document and scope access and retains the live Block registry', () => {
  const f = fixture(); assert.equal(f.state.reads, 0); assert.equal(f.state.prepared, 0); assert.equal(f.state.profiles, 0);
  assert.equal(Object.isFrozen(f.services), true); f.state.ready = true;
  assert.equal(f.services.catalog.blockDefinitionById('B1'), f.state.definitions[0]);
  const replacement = definition(); f.state.definitions = [replacement];
  assert.equal(f.services.catalog.blockDefinitionById('B1'), replacement); assert.equal(f.state.reads, 0);
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
