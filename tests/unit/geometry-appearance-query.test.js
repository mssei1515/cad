const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/document/appearance.js', 'src/geometry/appearance_query.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
const { Point, Line } = sandbox.window.GeometrySolver;

test('dimension appearance reads current document defaults and editing sketches only when queried', () => {
  let active = 'S1', sketches = [{ id: 'ROOT', kind: 'root', dimensionAppearance: { color: '#ff0000' } },
    { id: 'S1', dimensionAppearance: { color: '#333333', lineWidth: 3 } }];
  const calls = [], document = { defaultDimensionAppearance: { color: '#111111', terminatorType: 'filledArrow' }, defaultTerminatorAppearance: { terminatorType: 'dot' } };
  const query = sandbox.window.GeometryAppearanceQuery.createDimension({ document,
    currentSketches: () => { calls.push('sketches'); return sketches; }, activeSketchId: () => { calls.push('active'); return active; },
    isRootSketch: sketch => sketch?.kind === 'root' });
  assert.deepEqual(calls, []);
  const dimension = { display: { lineWidth: 4 } }, before = JSON.stringify({ document, sketches, dimension });
  const appearance = query.effectiveDimensionAppearance(dimension);
  assert.equal(appearance.color, '#333333'); assert.equal(appearance.lineWidth, 4); assert.equal(appearance.terminatorType, 'dot');
  assert.deepEqual(calls, ['active', 'sketches']); assert.equal(JSON.stringify({ document, sketches, dimension }), before);
  sketches = [{ id: 'S2', dimensionAppearance: { color: '#444444' } }]; active = 'S2';
  document.defaultTerminatorAppearance.terminatorType = 'arrow';
  assert.equal(query.effectiveDimensionAppearance(null).color, '#444444');
  assert.equal(query.effectiveDimensionAppearance(null).terminatorType, 'arrow');
  active = 'missing'; assert.equal(query.effectiveDimensionAppearance(null).color, '#111111');
});

test('dimension appearance respects explicit definition sketches and excludes Root styling without reading the editing scope', () => {
  const document = { defaultDimensionAppearance: { color: '#111111' }, defaultTerminatorAppearance: { terminatorSize: 7 } };
  const query = sandbox.window.GeometryAppearanceQuery.createDimension({ document,
    currentSketches: () => { throw Error('explicit sketches must bypass current scope'); },
    activeSketchId: () => { throw Error('explicit sketch must bypass active sketch'); }, isRootSketch: sketch => sketch?.kind === 'root' });
  const root = { id: 'ROOT', kind: 'root', dimensionAppearance: { color: '#ff0000' } };
  const local = { id: 'local', dimensionAppearance: { color: '#333333', lineWidth: 3 } };
  assert.equal(query.effectiveDimensionAppearance(null, 'local', [root, local]).color, '#333333');
  assert.equal(query.dimensionDisplayState(null, 'local', [root, local]).lineWidth, 3);
  assert.equal(query.effectiveDimensionAppearance(null, 'missing', [root, local]).color, '#111111');
  assert.equal(query.effectiveDimensionAppearanceForSketch(root).color, '#111111');
  assert.equal(query.effectiveDimensionAppearanceForSketch(local).color, '#333333');
  assert.equal(query.effectiveDimensionAppearanceForSketch(null).terminatorSize, 7);
});

test('dimension display snapshots retain the established numeric, affix, tolerance and terminator values without changing stored data', () => {
  const document = { defaultDimensionAppearance: {}, defaultTerminatorAppearance: {} };
  const query = sandbox.window.GeometryAppearanceQuery.createDimension({ document, currentSketches: () => [], activeSketchId: () => 'S1', isRootSketch: () => false });
  const dimension = { display: { visible: false, color: '#ABCDEF', lineWidth: 2, precision: 40, prefix: 'A\n', suffix: 'mm',
    toleranceUpper: '+0.2', toleranceLower: '-0.1', terminatorType: 'dot', terminatorSize: 4, arrowheadAngle: 45,
    extensionLineOvershoot: 5, extensionLineOriginGap: 6, dimensionTextHeight: 7, dimensionTextGap: 8 } };
  const before = JSON.stringify(dimension), state = query.dimensionDisplayState(dimension);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), { visible: false, color: '#abcdef', lineWidth: 2, precision: 10,
    prefix: 'A\n', suffix: 'mm', toleranceUpper: '0.2', toleranceLower: '-0.1', terminatorType: 'dot', terminatorSize: 4,
    arrowheadAngle: 45, extensionLineOvershoot: 5, extensionLineOriginGap: 6, dimensionTextHeight: 7, dimensionTextGap: 8 });
  state.color = '#000000'; assert.equal(query.dimensionDisplayState(dimension).color, '#abcdef');
  const defaults = query.dimensionDisplayState(null);
  assert.equal(defaults.precision, null); assert.equal(defaults.prefix, ''); assert.equal(defaults.suffix, '');
  assert.equal(defaults.toleranceUpper, ''); assert.equal(defaults.toleranceLower, '');
  assert.equal(defaults.color, sandbox.window.Appearance.DEFAULT_DIMENSION_APPEARANCE.color);
  assert.equal(JSON.stringify(dimension), before);
});
function fixture() {
  const state = { hidden: false, caching: false, cache: new WeakMap() };
  const document = { defaultAppearance: { color: '#111111', lineWidth: 1 }, defaultConstructionAppearance: { color: '#222222', lineWidth: 2 } };
  const sketches = [{ id: 'ROOT', kind: 'root', appearance: { color: '#ff0000' } }, { id: 'S1', appearance: { color: '#333333' }, constructionAppearance: { color: '#444444' } }];
  const query = sandbox.window.GeometryAppearanceQuery.create({ document,
    readAppearance: item => state.caching ? state.cache.get(item) : null,
    cacheAppearance: (item, appearance) => { if (state.caching) state.cache.set(item, appearance); },
    sketchById: id => sketches.find(s => s.id === id), elementSketchId: item => item?.sketchId,
    isRootSketch: s => s?.kind === 'root', activeSketchId: () => 'S1', showHiddenElements: () => state.hidden });
  const line = Object.assign(new Line('L1', new Point('P1', 0, 0), new Point('P2', 10, 0)), { sketchId: 'S1' });
  return { query, state, document, sketches, line };
}

test('geometry appearance resolves document, sketch and element layers without changing stored data', () => {
  const f = fixture(), { query: q, line } = f;
  assert.equal(q.effectiveAppearanceForElement(line).color, '#333333');
  line.construction = true; assert.equal(q.effectiveAppearanceForElement(line).color, '#444444');
  line.appearance = { color: '#555555' }; const before = JSON.stringify(line);
  assert.equal(q.effectiveAppearanceForElement(line).color, '#555555'); assert.equal(JSON.stringify(line), before);
  assert.equal(q.effectiveAppearanceForSketch(f.sketches[0]).color, '#111111');
  assert.equal(q.effectiveConstructionAppearanceForSketch(f.sketches[1]).color, '#444444');
});

test('block and derived overrides retain source precedence and cache only through the supplied read scope', () => {
  const f = fixture(), q = f.query;
  const local = { sketchId: 'inner', appearance: { color: '#555555' } };
  const block = { blockProjection: true, sketchId: 'S1', localElement: local,
    blockDefinition: { sketches: [{ id: 'inner', appearance: { color: '#666666' } }] }, blockAppearanceOverrides: [{ color: '#777777' }] };
  assert.equal(q.effectiveAppearanceForElement(block).color, '#777777');
  const derived = { derivedProjection: true, sourceElement: block, derivedInstance: { appearanceOverride: { color: '#888888' } } };
  assert.equal(q.effectiveAppearanceForElement(derived).color, '#888888');
  f.state.caching = true; const cached = q.effectiveAppearanceForElement(derived);
  derived.derivedInstance.appearanceOverride.color = '#999999';
  assert.equal(q.effectiveAppearanceForElement(derived), cached);
  f.state.caching = false; assert.equal(q.effectiveAppearanceForElement(derived).color, '#999999');
  assert.equal(local.appearance.color, '#555555');
});

test('visibility combines sketch and element appearance and reads show-hidden state on every call', () => {
  const f = fixture(), q = f.query;
  assert.equal(q.isVisibleSketchElement(f.line), true);
  f.line.appearance = { visible: false }; assert.equal(q.isVisibleSketchElement(f.line), false);
  f.state.hidden = true; assert.equal(q.isVisibleSketchElement(f.line), true);
  assert.equal(q.isVisibleSketchId('missing'), false);
  f.state.hidden = false; f.line.appearance = {}; f.sketches[1].appearance.visible = false;
  assert.equal(q.isVisibleSketchId(), false); assert.equal(q.isVisibleSketchElement(f.line), false);
});

test('hidden definition sketches hide projected construction geometry independently of appearance overrides', () => {
  const f = fixture(), q = f.query;
  const hidden = { id: 'inner', appearance: { visible: false }, constructionAppearance: {} };
  const child = { id: 'child', parentSketchId: 'inner', appearance: {}, constructionAppearance: {} };
  const blockDefinition = { sketches: [hidden, child] };
  const { Circle, Arc, Spline } = sandbox.window.GeometrySolver;
  const geometry = [f.line, new Circle('C', f.line.p1, 5, true), new Arc('A', f.line.p1, 5, 0, Math.PI, true),
    new Spline('SP', [f.line.p1, f.line.p2], false, true)];
  for (const item of geometry) {
    Object.assign(item, { construction: true, sketchId: 'S1', blockProjection: true, blockDefinition,
      localElement: { sketchId: 'inner', appearance: { visible: true } }, blockAppearanceOverrides: [{ visible: true }] });
    assert.equal(q.isVisibleSketchElement(item), false);
    f.state.hidden = true; assert.equal(q.isVisibleSketchElement(item), true);
    f.state.hidden = false;
    item.localElement.sketchId = 'child'; assert.equal(q.isVisibleSketchElement(item), true);
    item.localElement.sketchId = 'inner';
    hidden.appearance.visible = true; assert.equal(q.isVisibleSketchElement(item), true);
    hidden.appearance.visible = false;
  }
});

test('annotation appearance keeps plain text independent and reads current defaults/sketches for inherited leaders', () => {
  let sketches = [{ id: 'S', leaderAppearance: { color: '#333333' } }], reads = 0;
  const document = { defaultLeaderAppearance: { color: '#111111' }, defaultTerminatorAppearance: { terminatorType: 'dot' } };
  const query = sandbox.window.GeometryAppearanceQuery.createAnnotation({ document, currentSketches: () => { reads++; return sketches; } });
  const plain = { type: 'text', style: { color: '#222222', precision: 2, prefix: 'p' } };
  assert.equal(query.effectiveAnnotationStyle(plain).color, '#222222'); assert.equal(reads, 0);
  const leader = { type: 'leader', appearanceInheritance: true, sketchId: 'S', style: { precision: 3, prefix: 'a', suffix: 'b' } };
  const before = JSON.stringify(leader), style = query.effectiveAnnotationStyle(leader);
  assert.equal(style.color, '#333333'); assert.equal(style.terminatorType, 'dot'); assert.equal(style.precision, 3); assert.equal(style.prefix, 'a'); assert.equal(style.suffix, 'b');
  sketches = [{ id: 'S', leaderAppearance: { color: '#444444' } }]; document.defaultTerminatorAppearance = { terminatorType: 'filledArrow' };
  assert.equal(query.effectiveAnnotationStyle(leader).color, '#444444'); assert.equal(query.effectiveAnnotationStyle(leader).terminatorType, 'filledArrow');
  assert.equal(query.effectiveLeaderAppearanceForSketch(sketches[0]).color, '#444444');
  assert.equal(JSON.stringify(leader), before);
});
test('projected annotation appearance uses definition/local source and ordered Block overrides without changing stored styles', () => {
  const document = { defaultLeaderAppearance: { color: '#111111' }, defaultTerminatorAppearance: {} };
  const query = sandbox.window.GeometryAppearanceQuery.createAnnotation({ document, currentSketches: () => { throw new Error('definition sketch must short circuit scope'); } });
  const source = { type: 'leader', sketchId: 'local', appearanceInheritance: true, style: { precision: 1, prefix: 'local', suffix: 'mm', lineWidth: 2 } };
  const element = { type: 'leader', sketchId: 'outer', localElement: source, style: { color: '#ff0000' }, blockDefinition: { sketches: [{ id: 'local', leaderAppearance: { color: '#333333' } }] },
    blockAppearanceOverrides: [{ color: '#444444', lineWidth: 3 }, { color: '#555555' }] };
  const before = JSON.stringify(element), style = query.effectiveAnnotationStyle(element);
  assert.equal(style.color, '#555555'); assert.equal(style.lineWidth, 3); assert.equal(style.prefix, 'local'); assert.equal(style.suffix, 'mm'); assert.equal(style.precision, 1); assert.equal(JSON.stringify(element), before);
  source.appearanceInheritance = false; source.rotation = 27;
  assert.equal(query.effectiveAnnotationStyle(element).rotation, 27);
});
