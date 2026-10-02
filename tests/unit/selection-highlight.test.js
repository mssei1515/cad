const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/selection_highlight.js'), 'utf8'), sandbox);
const types = Object.fromEntries(["Point", "Line", "Circle", "Arc", "Spline", "OffsetChainConstraint"].map(name => [name, class {}]));
function fixture() {
  let hoveredDimension = null, draws = 0;
  const selection = { points: [], lines: [], circles: [], arcs: [], splines: [], blockInstances: [] };
  const highlight = sandbox.window.SelectionHighlight.create({ canvasSelection: selection,
    blockProjectionBundle: instance => instance.bundle, geometryRefsEqual: (a, b) => a === b, geometryRefForItem: item => item.ref,
    constraintGraphNodes: item => item.nodes, types,
    effectiveSelectedConstraint: () => selection.constraint, targetFromConstraint: item => item.dimension,
    getHoveredDimension: () => hoveredDimension, setHoveredDimension: value => { hoveredDimension = value; }, draw: () => draws++ });
  return { highlight, selection, get dimension() { return hoveredDimension; }, get draws() { return draws; } };
}
test('stale pointer leave does not clear a newer hover and dimension hover clears only its own marker', () => {
  const f = fixture(), first = { dimension: true }, second = { dimension: true };
  f.highlight.setSidebarHover('constraint', first, f.highlight.sidebarHoverElementsForConstraint(first));
  assert.equal(f.dimension, first); assert.equal(f.highlight.current.elements.size, 0);
  f.highlight.setSidebarHover('constraint', second, new Set());
  f.highlight.clearSidebarHover('constraint', first);
  assert.equal(f.dimension, second); assert.equal(f.draws, 2);
  f.highlight.clearSidebarHover('geometry', second); assert.equal(f.draws, 2);
  f.highlight.clearSidebarHover('constraint', second);
  assert.equal(f.dimension, null); assert.equal(f.highlight.current, null); assert.equal(f.draws, 3);
  f.highlight.setSidebarHover('geometry', {}, new Set()); const before = f.draws;
  f.highlight.reset(); assert.equal(f.highlight.current, null); assert.equal(f.draws, before);
});
test('projection identity survives regenerated objects while ordinary equal ids do not alias', () => {
  const f = fixture(), original = { blockProjection: {}, ref: 'B1/L1' }, regenerated = { blockProjection: {}, ref: 'B1/L1' };
  f.highlight.setSidebarHover('geometry', original, new Set([original]));
  assert.equal(f.highlight.isSidebarHoveredElement(regenerated), true);
  assert.equal(f.highlight.isSidebarHoveredElement({ ref: 'B1/L1' }), false);
  assert.equal(f.highlight.isSidebarHoveredElement({ blockProjection: {}, ref: 'B2/L1' }), false);
  f.selection.constraint = { nodes: [original] };
  assert.equal(f.highlight.isSelectedConstraintRelatedElement(regenerated), true);
});
test('selection reference expansion includes primitive endpoints and block projections without duplicates', () => {
  const f = fixture(), a = {}, b = {}, line = { p1: a, p2: b }, projected = {};
  f.selection.points.push(a); f.selection.lines.push(line);
  const block = { bundle: { points: [projected], lines: [], circles: [], arcs: [] } };
  f.selection.blockInstances.push(block);
  const elements = f.highlight.selectedConstraintReferenceElements();
  assert.deepEqual(Array.from(elements), [a, line, b, block, projected]);
  assert.equal(f.highlight.constraintDirectlyReferencesCanvasSelection({ nodes: [b] }), true);
  assert.equal(f.highlight.constraintDirectlyReferencesCanvasSelection({ nodes: [{}] }), false);
});

test('constraint display suppresses incidental line endpoints but retains directly constrained points', () => {
  const f = fixture(), a = new types.Point(), b = new types.Point();
  const line = Object.assign(new types.Line(), { p1: a, p2: b });
  const constraint = { line, point: a, nodes: [line, a, b] };
  assert.deepEqual(Array.from(f.highlight.constraintHighlightNodes(constraint)), [line, a]);
  assert.deepEqual(Array.from(f.highlight.sidebarHoverElementsForConstraint(constraint)), [line, a]);
  f.selection.constraint = constraint;
  assert.equal(f.highlight.isSelectedConstraintRelatedElement(a), true);
  assert.equal(f.highlight.isSelectedConstraintRelatedElement(b), false);
  f.selection.points.push(b);
  assert.equal(f.highlight.constraintDirectlyReferencesCanvasSelection(constraint), true);
});
test('constraint entries retain geometry role order, localized labels and Offset chain order', () => {
  const f = fixture(), point = new types.Point(), line = new types.Line(), spline = new types.Spline();
  const entries = f.highlight.constraintDefiningGeometryEntries({ point, line, spline, target: { id: 'untyped' } });
  assert.deepEqual(Array.from(entries, e => e.key), ['point', 'line', 'spline']);
  assert.equal(entries[0].labelJa, '点ID'); assert.equal(entries[0].labelEn, 'Point ID');
  assert.equal(entries[0].item, point);
  const chain = Object.assign(new types.OffsetChainConstraint(), { sources: [line, spline], offsets: [point] });
  const chainEntries = f.highlight.constraintDefiningGeometryEntries(chain);
  assert.deepEqual(Array.from(chainEntries, e => e.key), ['source0', 'source1', 'offset0']);
  assert.deepEqual(Array.from(chainEntries, e => e.item), [line, spline, point]);
  assert.equal(chainEntries[1].labelJa, '基準図形2 ID');
  assert.equal(chainEntries[2].labelEn, 'Offset geometry 1 ID');
  assert.equal(f.highlight.constraintDefiningGeometryEntries(null).length, 0);
});
