const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/document/appearance.js', 'src/geometry/appearance_query.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
const { Point, Line } = sandbox.window.GeometrySolver;
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
