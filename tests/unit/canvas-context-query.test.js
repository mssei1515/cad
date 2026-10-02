const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(p => p.startsWith('src/'))) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox);
const empty = () => ({ points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [], annotations: [], blockInstances: [], geometryInstances: [], hatches: [] });
const point = (id, x, y = 0) => ({ id, x, y, sketchId: 'S1' });
const line = (id, y = 0, drawingOrder = 0) => ({ id, p1: point('a', -20, y), p2: point('b', 20, y), sketchId: 'S1', drawingOrder });
function fixture() {
  let model = empty(), scale = 1, edited = [], showHidden = false;
  const visible = item => item.visible !== false && item.sketchId !== 'hidden';
  const query = sandbox.window.CanvasContextQuery.create({ currentScope: () => model, viewportScale: () => scale,
    canvasContextPointIsSelectable: p => p.selectable !== false, editedFitPoints: () => edited,
    isVisibleValue: visible => showHidden || visible !== false,
    sketches: { isEditableSketchId: id => id === 'S1', isVisibleSketchId: id => id !== 'hidden',
      isEditableSketchElement: item => item.sketchId === 'S1', isVisibleSketchElement: visible,
      activeSketchId: () => 'S1', isActiveSketchConstraint: item => item.sketchId === 'S1', constraintSketchId: item => item.sketchId },
    projections: { blockProjectionBundle: item => item.bundle, geometryInstanceBundle: item => item.bundle },
    dimensions: { targetFromConstraint: c => c.target, defaultDimensionForTarget: () => ({}),
      effectiveDimensionAppearance: d => d, dimensionLayout: target => target },
    annotations: { canvasContextAnnotationHit: item => item.hit },
    hatches: { resolvedHatchBoundary: item => ({ ok: item.valid !== false }), hatchAppearanceForDisplay: item => item,
      hatchContainsSelectablePoint: (item, resolved) => resolved.ok && item.contains === true } });
  return { query, model: () => model, scope: value => { model = value; }, zoom: value => { scale = value; },
    edit: value => { edited = value; }, showHidden: value => { showHidden = value; } };
}
const ids = hits => Array.from(hits, h => h.item.id);
test('candidate order uses distance, kind priority and descending drawing order without mutating source arrays', () => {
  const f = fixture(), m = f.model(), p = point('P', 0), old = line('old', 0, 1), top = line('top', 0, 2);
  m.points.push(p); m.lines.push(old, top);
  assert.deepEqual(ids(f.query.candidatesAt({ x: 0, y: 0 })), ['P', 'top', 'old']);
  p.x = 2; assert.deepEqual(ids(f.query.candidatesAt({ x: 0, y: 0 })), ['top', 'old', 'P']);
  assert.deepEqual(m.lines, [old, top]);
});
test('scope, zoom, visibility and point eligibility are read for each query', () => {
  const f = fixture(), m = f.model();
  m.points.push(point('far', 8), { ...point('hidden', 0), visible: false }, { ...point('other', 0), sketchId: 'S2' }, { ...point('implicit', 0), selectable: false });
  assert.deepEqual(ids(f.query.candidatesAt({ x: 0, y: 0 })), ['far']);
  f.zoom(2); assert.equal(f.query.candidatesAt({ x: 0, y: 0 }).length, 0);
  const next = empty(); next.lines.push(line('new')); f.scope(next);
  assert.deepEqual(ids(f.query.candidatesAt({ x: 0, y: 0 })), ['new']);
});
test('an edited spline fit point takes precedence over overlapping ordinary candidates', () => {
  const f = fixture(), p = point('fit', 3); f.model().points.push(p); f.model().lines.push(line('L'));
  f.edit([p]); assert.deepEqual(ids(f.query.candidatesAt({ x: 0, y: 0 })), ['fit']);
  f.edit([]); assert.deepEqual(ids(f.query.candidatesAt({ x: 0, y: 0 })), ['L', 'fit']);
});
test('projected geometry and annotation hits aggregate to their owning block or derived instance', () => {
  const f = fixture(), block = { id: 'B', sketchId: 'S1', bundle: empty() }, instance = { id: 'I', sketchId: 'S1', bundle: empty() };
  block.bundle.lines.push(line('projected')); block.bundle.annotations.push({ hit: { distance: 0 } });
  instance.bundle.points.push(point('derived', 0)); f.model().blockInstances.push(block); f.model().geometryInstances.push(instance);
  assert.deepEqual(ids(f.query.candidatesAt({ x: 0, y: 0 })), ['B', 'I']);
  block.sketchId = 'S2'; assert.deepEqual(ids(f.query.candidatesAt({ x: 0, y: 0 })), ['I']);
});
test('dimension visibility follows show hidden elements and preserves label priority on a line overlap', () => {
  const f = fixture(), constraint = { id: 'D', sketchId: 'S1', dimension: { visible: false },
    target: { text: { x: 0, y: 0 }, hitA: { x: -10, y: 0 }, hitB: { x: 10, y: 0 } } };
  f.model().constraints.push(constraint); assert.equal(f.query.candidatesAt({ x: 0, y: 0 }).length, 0);
  f.showHidden(true); const [hit] = f.query.candidatesAt({ x: 0, y: 0 });
  assert.equal(hit.item, constraint); assert.equal(hit.hit.part, 'label'); assert.equal(hit.contextDistance, 0);
});
test('candidate presentation uses injected labels, live block names and annotation truncation', () => {
  let name = 'Original';
  const present = sandbox.window.CanvasContextPresentation.create({ toolbarSvgMarkup: selector => selector,
    applicationText: (ja, en) => en, formatDisplayNumber: n => n.toFixed(2), constraintToolbarIcon: () => 'constraint',
    localizedConstraintName: value => value, blockDefinitionById: () => ({ name }), geometryInstanceTypeLabel: type => type,
    hatchPatternTypeLabel: type => type, hatchAppearanceForDisplay: item => item });
  assert.equal(present({ kind: 'point', item: point('P', 1, 2) }).secondary, 'X 1.00 / Y 2.00');
  const block = { kind: 'block', item: { id: 'B', definitionId: 'BD' } };
  assert.equal(present(block).secondary, 'Original'); name = 'Renamed'; assert.equal(present(block).secondary, 'Renamed');
  assert.equal(present({ kind: 'annotation', item: { id: 'T', type: 'text', text: 'a'.repeat(60) } }).secondary.length, 40);
});
